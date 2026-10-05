(() => {
  const storageKey = "app_ocorrencias";
  const apiBase = window.MANUTENCAO_API_URL || "/api";

  function localTickets() {
    try { return JSON.parse(localStorage.getItem(storageKey) || "[]"); } catch { return []; }
  }

  function saveLocal(tickets) {
    localStorage.setItem(storageKey, JSON.stringify(tickets));
    return tickets;
  }

  async function request(path, options = {}) {
    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) }
    });
    if (!response.ok) throw new Error(`API respondeu ${response.status}`);
    return response.json();
  }

  window.occurrenceApi = {
    async sync() {
      try {
        const tickets = await request("/occurrences");
        saveLocal(tickets);
        return { connected: true, tickets };
      } catch {
        return { connected: false, tickets: localTickets() };
      }
    },
    async create(ticket) {
      try {
        const created = await request("/occurrences", { method: "POST", body: JSON.stringify({
          location: ticket.propriedade,
          category: ticket.categoria,
          environment: ticket.ambiente,
          element: ticket.elemento,
          situation: ticket.situacao,
          action: ticket.acao,
          priority: ticket.nivel,
          description: ticket.descricao,
          responsible: ticket.responsavel,
          dueDate: ticket.prazo,
          media: ticket.media || [],
          audio: ticket.audio || null
        }) });
        saveLocal([created, ...localTickets()]);
        return { connected: true, ticket: created };
      } catch {
        saveLocal([ticket, ...localTickets()]);
        return { connected: false, ticket };
      }
    },
    async updateStatus(id, status) {
      try {
        const updated = await request(`/occurrences/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
        saveLocal(localTickets().map(ticket => ticket.id === id ? { ...ticket, ...updated } : ticket));
        return { connected: true, ticket: updated };
      } catch {
        return { connected: false };
      }
    },
    async updateMedia(id, mediaAfter) {
      try {
        const updated = await request(`/occurrences/${id}`, { method: "PATCH", body: JSON.stringify({ mediaAfter }) });
        saveLocal(localTickets().map(ticket => ticket.id === id ? { ...ticket, ...updated } : ticket));
        return { connected: true, ticket: updated };
      } catch {
        return { connected: false };
      }
    }
  };
})();
