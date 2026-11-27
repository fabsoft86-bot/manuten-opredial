# FixPro — Plano de portar funcionalidades da versão antiga

> Criado em 2026-11-27. Documento vivo: https://claude.ai/artifact/J6KmtKGyMJjganANvjErEZ
> A versão antiga (HTML/JS puro) está no commit `9ebb80c`. Use-a só como referência de regras e listas, nunca copie o código.

## Direção escolhida: primeiro cliente (27/11/2026)

O objetivo agora é ter **um condomínio real usando o FixPro de graça em cerca de 8 semanas** (fim de janeiro de 2027). Isso substitui a ordem das 5 ondas descritas mais abaixo. Elas viram um cardápio, e cada item só entra quando o piloto pedir.

**Sprint 1 (~2 semanas): o chamado que o zelador usa de verdade**

- Separar o formulário do `WorkOrderManager` (só o necessário, não a quebra completa).
- Formulário guiado, checklist por categoria e descrição gerada, com as listas da versão antiga (`9ebb80c`).
- Responsável e prazo, com sugestão de responsável pela categoria.
- **Foto online:** até 3 por OS, comprimidas no celular e enviadas ao Supabase Storage. Sem internet, a OS é salva e o app avisa para anexar a foto quando houver sinal.
- Migration `005` (categoria, respostas guiadas, responsável, prazo) + bucket de fotos, com testes pgTAP, Dexie e sync atualizados.

**Sprint 2 (~1 semana): pronto para um cliente real**

- Backup semanal do banco (`supabase db dump`), porque o plano grátis não tem backup.
- Trocar a senha fraca de teste e criar as contas do piloto à mão (evita o limite de 2 e-mails por hora do Supabase).
- Termo simples de uso e privacidade (LGPD mínima).
- Teste no celular do zelador, inclusive instalando o app.
- Hospedagem: a Vercel Hobby proíbe uso comercial. Num piloto grátis é zona cinzenta. A migração para a exportação estática num serviço grátis que permita uso comercial (G5) tem que acontecer **antes de cobrar**, ou já aqui se sobrar tempo.

**Em paralelo, desde já: achar o condomínio**

- Listar 5 contatos: condomínios onde o fundador trabalhou, síndicos conhecidos, clientes da época de eletricista.
- Conversa de 30 minutos com cada um, antes de mostrar o app: como registram os chamados hoje (WhatsApp, caderno, nada?), o que mais irrita, quem abre e quem resolve, e o que fariam se tivessem uma ferramenta.
- Piloto de 4 semanas com o melhor contato. Medir chamados por semana, quem usou de verdade e o que pediram.

**O que espera o piloto:** outbox completo, conflitos D+C, `memberships`, quadro em colunas, recorrência, áudio e status extras. Com um cliente só, o modelo atual de tenant e o sync de hoje aguentam.

## Resumo

A versão antiga do FixPro (HTML/JS puro, último estado completo no commit `9ebb80c`, de 10/10/2026) tem cerca de 15 funcionalidades que a versão nova em Next.js não tem.

A recomendação principal: **portar a lógica e os dados, não o código**. A versão antiga guardava tudo no `localStorage` e as fotos em base64. A nova tem Supabase, RLS, offline com Dexie e papéis de verdade. O que vale reaproveitar são as listas (categorias, checklists, sugestões de responsável) e as regras (duplicado, recorrência, descrição gerada).

## Inventário: antiga x nova

De 19 funcionalidades da versão antiga, 3 já existem na nova, 15 entram no plano e 1 não será portada. A coluna "Onde está" aponta a função no `index.html` do commit `9ebb80c` (`git show 9ebb80c:index.html`).

| Funcionalidade (versão antiga) | Onde está | Na nova? | Destino |
| --- | --- | --- | --- |
| Formulário guiado (categoria, ambiente, item, situação, ação) | `guidedOptions`, `updateGuidedOptions` | Não | Sprint 1 |
| Descrição gerada a partir das respostas | `updateGeneratedDescription` | Não | Sprint 1 |
| Checklist por categoria antes de enviar | `checklists`, `renderChecklist` | Não | Sprint 1 |
| Sugestão de responsável por categoria | `routingSuggestions` | Não | Sprint 1 |
| Responsável e prazo no chamado | campos `responsavel`, `prazo` | Não | Sprint 1 |
| Fotos do problema e fotos depois do serviço | `readSelectedPhotos`, `addAfterPhotos` | Não | Sprint 1 (só online) |
| Aviso de chamado duplicado aberto | `findSimilarOpenTicket` | Não | Depois do piloto |
| Histórico (linha do tempo de status) | `renderTimeline` | Não | Depois do piloto (`work_order_events`) |
| Status de triagem, atribuída, aguardando material | `statusLabels` | Parcial | Depois do piloto (decisão D2) |
| Quadro de tarefas em colunas | `renderTasks` | Não | Depois do piloto |
| Sinais de recorrência (45 dias) e frequência por local | `findRecurringPattern`, `renderRecurringSignals` | Não | Depois do piloto |
| Áudio gravado no relatório | `startAudioRecording` | Não | Depois do piloto |
| Rascunho automático do formulário | `saveDraft`, `restoreDraft` | Não | Cardápio (barato) |
| Acessibilidade (texto grande, alto contraste) | `applyAccessibility` | Não | Cardápio (barato) |
| Ditado por voz na observação | `SpeechRecognition` | Não | Cardápio (só online) |
| Busca, filtros e exportar CSV | `renderHistory`, `exportTickets` | Sim | Já existe |
| Instalar aplicativo (PWA) | `manifest.json`, `sw.js` | Sim | Já existe (melhor na nova) |
| Telas Operador e Gestão | `switchRole` | Sim, por papel | Já existe: papéis com RLS substituem o seletor manual |
| Locais favoritos | `toggleFavoriteLocation` | Não | Não portar: o cadastro de imóveis cobre |

O que só a nova tem e precisa ser preservado: login real, multi-cliente com RLS, imóveis cadastrados, offline com sincronização, CI e testes pgTAP.

## Cardápio de ondas (depois do piloto)

1. **Onda 0 — Catálogo de dados.** Listas da versão antiga em `src/core/catalog/maintenance.ts` e regras (descrição gerada, duplicado, recorrência) como funções puras em `src/core/rules/`, com testes Vitest. Parte disso já entra na Sprint 1.
2. **Onda 1 — Melhorias só de tela.** Pré-requisito: `WorkOrderManager` quebrado em módulos (`WorkOrderForm`, `WorkOrderList`, `PropertyPanel`, `MetricsBar`). Rascunho automático (Dexie, por usuário e tenant), acessibilidade e ditado por voz (só com internet: o reconhecimento de voz do Chrome roda no servidor do Google).
3. **Onda 2 — Chamado completo.** `work_order_events` (linha do tempo), aviso de duplicado ao escolher imóvel e categoria.
4. **Onda 3 — Gestão.** Status extras (D2), quadro em colunas para gestor e admin, recorrência e frequência por imóvel (base do "relatório por imóvel" da Fase 3).
5. **Onda 4 — Mídia offline.** Fotos e áudio com fila resumível e limite local, junto com o outbox (Fase 2).

## Mudanças no banco

Todas pela Supabase CLI (`supabase migration new` e `supabase db push`, nunca pelo SQL Editor).

| Migration | O que muda | Quando |
| --- | --- | --- |
| `005_work_order_details` | `category text` (`electrical`, `plumbing`, `civil`, `hvac`, `security`, `cleaning`, `other`), `guided jsonb` (ambiente, item, situação, ação, checklist marcado), `assignee_name text`, `due_date date` | Sprint 1 |
| `006_work_order_photos` | Bucket no Storage + tabela `work_order_media` (antes/depois), com políticas por tenant | Sprint 1 |
| `007_work_order_events` | Tabela `work_order_events` + trigger que grava cada troca de status, com RLS por tenant | Depois do piloto |
| `008_status_extras` | Ampliar o `CHECK` de status com `triage`, `assigned` e `waiting_parts` (se D2 aprovar) | Depois do piloto |

Cada migration arrasta 4 ajustes obrigatórios:

- Testes pgTAP novos em `supabase/tests/database/` (isolamento entre tenants e permissões por papel).
- `supabase gen types` no lugar do `src/types/database.ts` escrito à mão.
- Nova versão do schema no Dexie (`src/lib/db/indexedDB.ts`).
- Campos novos no `syncService` e nos repositórios, senão eles se perdem no sync.

O responsável começa como texto livre. Quando entrarem prestadores (Fase 4), passa a apontar para um usuário.

## O que não portar

- **`localStorage` como banco** (`app_ocorrencias`): substituído por Dexie + Supabase com RLS.
- **Fotos e áudio em base64** dentro do registro: estouram o armazenamento e o sync. Vão para o Storage.
- **Seletor manual Operador/Gestão** (`switchRole`): agora a tela depende do papel.
- **`api-client.js`, `mock-server.js` e `mock-data.json`**: o app novo fala direto com o Supabase.
- **Locais favoritos**: o cadastro de imóveis cobre. Se fizer falta no piloto, volta como "imóveis recentes".
- **Estilos visuais** da versão antiga: as telas novas seguem o visual atual (Tailwind, tema escuro), conforme o `.cursorrules`.

## Como executar no Claude Code

1. Deixar a versão antiga ao lado, só para leitura (na pasta do projeto):

   ```
   git worktree add ../versao-antiga 9ebb80c
   ```

2. Sprint 1, primeira sessão:

   ```
   Leia HANDOFF.md e docs/PORTE_VERSAO_ANTIGA.md. Comece a Sprint 1: extraia de ../versao-antiga/index.html as listas guidedOptions, checklists e routingSuggestions para src/core/catalog/maintenance.ts e a regra de descrição gerada para src/core/rules/, com testes Vitest no CI. Depois separe o formulário do WorkOrderManager e implemente o formulário guiado. Antes de codar, liste os arquivos que vai mudar e as migrations. No fim: tsc, lint, build, teste offline e HANDOFF atualizado.
   ```

3. Quando terminar o porte, remover a pasta de referência: `git worktree remove ../versao-antiga`.

## Decisões pendentes

- [x] **D1:** plano aprovado em 27/11/2026, com a direção "primeiro cliente".
- [ ] **D2 (depois do piloto):** quais status extras entram. Sugestão: triagem, atribuída e aguardando material.
- [ ] **D3 (Sprint 1):** confirmar as 7 categorias (Elétrica, Hidráulica, Civil, Climatização, Segurança, Limpeza, Outra) ou ajustar após as conversas com clientes.
- [ ] **D4 (depois do piloto):** o aviso de duplicado só avisa ou bloqueia. Sugestão: só avisar.
- [ ] **D5:** existem chamados reais na versão antiga para importar? Se não, o script de migração fica de fora.

## Riscos

| Risco | Efeito | Como evitar |
| --- | --- | --- |
| Campo novo fora do sync | Dado some ao sincronizar | Checklist da migration (Dexie, `syncService`, tipos, pgTAP) |
| Construir antes de validar com clientes | Funcionalidade que ninguém usa | Conversas com condomínios em paralelo à Sprint 1 |
| Foto sem internet | Zelador perde a foto | Avisar e deixar anexar depois; fila offline só na Onda 4 |
| Fotos e áudio no iPhone | Gravação falha ou arquivo perdido | Testar em aparelho real (portão G3) |
| Vercel Hobby e uso comercial | Conta suspensa | Migrar a hospedagem antes de cobrar (G5) |
