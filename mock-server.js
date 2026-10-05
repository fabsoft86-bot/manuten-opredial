import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const root = path.dirname(fileURLToPath(import.meta.url));
const dataFile = path.join(root, "mock-data.json");
const port = Number(process.env.PORT || 3000);

async function readTickets() {
  try { return JSON.parse(await readFile(dataFile, "utf8")); } catch { return []; }
}
async function writeTickets(tickets) { await writeFile(dataFile, JSON.stringify(tickets, null, 2)); }
function json(response, status, payload) { response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" }); response.end(JSON.stringify(payload)); }
function body(request) { return new Promise((resolve, reject) => { let raw = ""; request.on("data", chunk => raw += chunk); request.on("end", () => { try { resolve(JSON.parse(raw || "{}")); } catch (error) { reject(error); } }); }); }
function normalize(ticket) { return { ...ticket, propriedade: ticket.propriedade || ticket.location, categoria: ticket.categoria || ticket.category || "Outra", ambiente: ticket.ambiente || ticket.environment || "", elemento: ticket.elemento || ticket.element || "", situacao: ticket.situacao || ticket.situation || "", acao: ticket.acao || ticket.action || "", nivel: ticket.nivel || ticket.priority, descricao: ticket.descricao || ticket.description, responsavel: ticket.responsavel || ticket.responsible || "", prazo: ticket.prazo || ticket.dueDate || "", data: ticket.data || new Date().toLocaleString("pt-BR"), createdAt: ticket.createdAt || new Date().toISOString(), status: ticket.status || "aberto" }; }

const server = createServer(async (request, response) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (request.method === "OPTIONS") { response.writeHead(204); return response.end(); }
  const url = new URL(request.url, `http://localhost:${port}`);

  try {
    if (url.pathname === "/api/health") return json(response, 200, { status: "ok", database: "mock-json" });
    if (url.pathname === "/api/occurrences" && request.method === "GET") {
      let tickets = (await readTickets()).map(normalize);
      const search = (url.searchParams.get("search") || "").toLowerCase();
      const status = url.searchParams.get("status");
      if (search) tickets = tickets.filter(ticket => `${ticket.propriedade} ${ticket.descricao}`.toLowerCase().includes(search));
      if (status && status !== "todos") tickets = tickets.filter(ticket => ticket.status === status);
      return json(response, 200, tickets.sort((a, b) => Number(b.id) - Number(a.id)));
    }
    if (url.pathname === "/api/occurrences" && request.method === "POST") {
      const input = normalize(await body(request));
      if (!input.propriedade || !input.descricao || !["green", "yellow", "red"].includes(input.nivel)) return json(response, 400, { error: "Dados obrigatórios inválidos." });
      const ticket = normalize({ ...input, id: randomUUID() });
      const tickets = await readTickets(); tickets.unshift(ticket); await writeTickets(tickets);
      return json(response, 201, ticket);
    }
    const match = url.pathname.match(/^\/api\/occurrences\/([^/]+)$/);
    if (match && request.method === "PATCH") {
      const input = await body(request); const tickets = await readTickets(); const index = tickets.findIndex(ticket => String(ticket.id) === match[1]);
      if (index < 0) return json(response, 404, { error: "Ocorrência não encontrada." });
      tickets[index] = { ...tickets[index], ...input, updatedAt: new Date().toISOString() }; await writeTickets(tickets); return json(response, 200, normalize(tickets[index]));
    }
    const staticFiles = {
      "/": { file: "index.html", type: "text/html; charset=utf-8" },
      "/index.html": { file: "index.html", type: "text/html; charset=utf-8" },
      "/favicon.ico": { file: "favicon.ico", type: "image/png" },
      "/api-client.js": { file: "api-client.js", type: "text/javascript; charset=utf-8" },
      "/manifest.json": { file: "manifest.json", type: "application/manifest+json; charset=utf-8" },
      "/sw.js": { file: "sw.js", type: "text/javascript; charset=utf-8" },
      "/js/api-client.js": { file: path.join("js", "api-client.js"), type: "text/javascript; charset=utf-8" },
      "/js/auth.js": { file: path.join("js", "auth.js"), type: "text/javascript; charset=utf-8" },
      "/js/auth-ui.js": { file: path.join("js", "auth-ui.js"), type: "text/javascript; charset=utf-8" },
      "/js/supabaseClient.js": { file: path.join("js", "supabaseClient.js"), type: "text/javascript; charset=utf-8" },
      "/icons/icon-192.png": { file: path.join("icons", "icon-192.png"), type: "image/png" },
      "/icons/icon-512.png": { file: path.join("icons", "icon-512.png"), type: "image/png" },
      "/icons/icon-192-maskable.png": { file: path.join("icons", "icon-192-maskable.png"), type: "image/png" },
      "/icons/icon-512-maskable.png": { file: path.join("icons", "icon-512-maskable.png"), type: "image/png" }
    };
    const asset = staticFiles[url.pathname];
    if (asset) {
      const body = await readFile(path.join(root, asset.file));
      response.writeHead(200, { "Content-Type": asset.type });
      return response.end(body);
    }
    response.writeHead(404); response.end("Não encontrado");
  } catch (error) { console.error(error); json(response, 500, { error: "Erro interno do mock API." }); }
});

server.listen(port, () => console.log(`Mock API disponível em http://localhost:${port}`));
