import { supabaseClient } from "./supabaseClient.js";

const STORAGE_BUCKET = "ticket-attachments";
const CACHE_KEY = "app_ocorrencias";
const TICKET_COLUMNS = "id, organization_id, title, description, status, priority, created_by, assigned_to, created_at, details, attachments";

function readLocalTickets() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "[]");
  } catch (error) {
    console.warn("O cache local de chamados está inválido:", error);
    return [];
  }
}

function saveLocalTickets(tickets) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(tickets));
}

function mapTicket(row) {
  const details = row.details || {};
  const attachments = row.attachments || [];
  const status = row.status === "open" ? "aberto" : row.status;
  const media = attachments
    .filter(attachment => attachment.kind === "photo")
    .map(attachment => ({ name: attachment.name, type: attachment.type, data: attachment.url, path: attachment.path }));
  const audioAttachment = attachments.find(attachment => attachment.kind === "audio");

  return {
    ...details,
    id: row.id,
    propriedade: details.propriedade || row.title,
    descricao: row.description || "",
    nivel: row.priority || "green",
    status,
    data: new Date(row.created_at).toLocaleString("pt-BR"),
    createdAt: row.created_at,
    responsavel: details.responsavel || "",
    prazo: details.prazo || "",
    history: details.history || [{ status, at: row.created_at }],
    media,
    audio: audioAttachment
      ? { name: audioAttachment.name, type: audioAttachment.type, data: audioAttachment.url, path: audioAttachment.path }
      : null,
    mediaAfter: (details.mediaAfter || []).map(photo => ({ ...photo, data: photo.url || photo.data }))
  };
}

async function getIdentity() {
  let user;
  try {
    const { data, error } = await supabaseClient.auth.getUser();
    if (error) throw error;
    user = data.user;
  } catch (error) {
    if (error?.name === "AuthSessionMissingError") {
      throw new Error("Entre com sua conta para gravar chamados no Supabase.");
    }
    throw error;
  }
  if (!user) {
    throw new Error("Entre com sua conta para gravar chamados no Supabase.");
  }

  const { data: profile, error: profileError } = await supabaseClient
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (profileError) {
    throw new Error(`Não foi possível localizar o perfil da organização: ${profileError.message}`);
  }
  if (!profile?.organization_id) {
    throw new Error("Sua conta ainda não possui uma organização vinculada. Solicite o provisionamento do perfil ao administrador.");
  }

  return { user, organizationId: profile.organization_id };
}

function fileFromDataUrl(dataUrl, fallbackType) {
  const [metadata, contents] = dataUrl.split(",", 2);
  if (!metadata || contents === undefined) throw new Error("Um anexo possui formato inválido.");
  const mimeType = metadata.match(/^data:([^;,]+)/)?.[1] || fallbackType || "application/octet-stream";
  const binary = atob(contents);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mimeType });
}

function safeFileName(name) {
  return String(name || "anexo").replace(/[^\w.-]+/g, "_").slice(-100);
}

function createObjectId() {
  return crypto.randomUUID();
}

async function uploadAttachments(ticket, identity, ticketId) {
  const files = [
    ...(ticket.media || []).map(file => ({ ...file, kind: "photo" })),
    ...(ticket.audio ? [{ ...ticket.audio, kind: "audio" }] : [])
  ];
  const uploaded = [];

  try {
    for (const file of files) {
      const path = `${identity.organizationId}/${identity.user.id}/${ticketId}/${createObjectId()}-${safeFileName(file.name)}`;
      const blob = file.data instanceof Blob ? file.data : fileFromDataUrl(file.data, file.type);
      const { error } = await supabaseClient.storage
        .from(STORAGE_BUCKET)
        .upload(path, blob, { contentType: file.type || blob.type, upsert: false });
      if (error) throw new Error(`Falha ao enviar ${file.name || "anexo"}: ${error.message}`);

      uploaded.push({
        kind: file.kind,
        name: file.name || "anexo",
        type: file.type || blob.type,
        path,
        url: supabaseClient.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl
      });
    }
    return uploaded;
  } catch (error) {
    if (uploaded.length) {
      const { error: cleanupError } = await supabaseClient.storage
        .from(STORAGE_BUCKET)
        .remove(uploaded.map(file => file.path));
      if (cleanupError) console.error("Falha ao remover anexos parciais:", cleanupError);
    }
    throw error;
  }
}

async function removeAttachments(attachments) {
  if (!attachments.length) return;
  const { error } = await supabaseClient.storage
    .from(STORAGE_BUCKET)
    .remove(attachments.map(file => file.path));
  if (error) console.error("Falha ao remover anexos órfãos:", error);
}

async function uploadDataUrlAttachment(dataUrl, name, type, kind, identity, ticketId) {
  const path = `${identity.organizationId}/${identity.user.id}/${ticketId}/${createObjectId()}-${safeFileName(name)}`;
  const blob = fileFromDataUrl(dataUrl, type);
  const { error } = await supabaseClient.storage
    .from(STORAGE_BUCKET)
    .upload(path, blob, { contentType: type || blob.type, upsert: false });
  if (error) throw new Error(`Falha ao enviar ${name}: ${error.message}`);

  return {
    kind,
    name: name || "anexo",
    type: type || blob.type,
    path,
    url: supabaseClient.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl
  };
}

async function fetchTickets() {
  const identity = await getIdentity();
  const { data, error } = await supabaseClient
    .from("tickets")
    .select(TICKET_COLUMNS)
    .eq("organization_id", identity.organizationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(mapTicket);
}

window.occurrenceApi = {
  async sync() {
    let user;
    try {
      const { data, error } = await supabaseClient.auth.getUser();
      if (error) throw error;
      user = data.user;
    } catch (error) {
      if (error?.name === "AuthSessionMissingError") {
        return { connected: false, tickets: readLocalTickets() };
      }
      throw error;
    }
    if (!user) return { connected: false, tickets: readLocalTickets() };

    const tickets = await fetchTickets();
    saveLocalTickets(tickets);
    return { connected: true, tickets };
  },

  async create(ticket) {
    const identity = await getIdentity();
    const ticketId = createObjectId();
    const attachments = await uploadAttachments(ticket, identity, ticketId);
    const { data: inserted, error } = await supabaseClient
      .from("tickets")
      .insert({
        id: ticketId,
        organization_id: identity.organizationId,
        title: ticket.propriedade,
        description: ticket.descricao,
        status: "open",
        priority: ticket.nivel,
        created_by: identity.user.id,
        assigned_to: null,
        details: {
          propriedade: ticket.propriedade,
          categoria: ticket.categoria,
          ambiente: ticket.ambiente,
          elemento: ticket.elemento,
          situacao: ticket.situacao,
          acao: ticket.acao,
          responsavel: ticket.responsavel,
          prazo: ticket.prazo,
          history: ticket.history
        },
        attachments
      })
      .select(TICKET_COLUMNS)
      .single();

    if (error) {
      await removeAttachments(attachments);
      throw new Error(`Falha ao gravar chamado no Supabase: ${error.message}`);
    }

    const created = mapTicket(inserted);
    saveLocalTickets([created, ...readLocalTickets().filter(item => item.id !== created.id)]);
    return { connected: true, ticket: created };
  },

  async updateStatus(id, status) {
    const { data: row, error: readError } = await supabaseClient
      .from("tickets")
      .select("details")
      .eq("id", id)
      .single();
    if (readError) throw readError;

    const nextHistory = [...(row.details?.history || []), { status, at: new Date().toISOString() }];
    const { error } = await supabaseClient
      .from("tickets")
      .update({
        status: status === "aberto" ? "open" : status,
        details: { ...(row.details || {}), history: nextHistory }
      })
      .eq("id", id);
    if (error) throw error;
    return { connected: true };
  },

  async updateMedia(id, mediaAfter) {
    const identity = await getIdentity();
    const { data: row, error: fetchError } = await supabaseClient
      .from("tickets")
      .select("details")
      .eq("id", id)
      .single();
    if (fetchError) throw fetchError;

    const attachments = [];
    const newlyUploaded = [];
    try {
      for (const photo of mediaAfter) {
        if (photo.path && photo.url) {
          attachments.push(photo);
        } else if (photo.data) {
          const uploaded = await uploadDataUrlAttachment(
            photo.data,
            photo.name,
            photo.type,
            "photo",
            identity,
            id
          );
          attachments.push(uploaded);
          newlyUploaded.push(uploaded);
        }
      }
    } catch (error) {
      await removeAttachments(newlyUploaded);
      throw error;
    }

    const { error } = await supabaseClient
      .from("tickets")
      .update({ details: { ...(row.details || {}), mediaAfter: attachments } })
      .eq("id", id);
    if (error) {
      await removeAttachments(newlyUploaded);
      throw error;
    }
    return {
      connected: true,
      mediaAfter: attachments.map(photo => ({ ...photo, data: photo.url }))
    };
  }
};
