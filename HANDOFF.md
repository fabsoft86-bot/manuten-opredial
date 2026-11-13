# HANDOFF — FixPro (Manutenção Predial)

> Documento de passagem entre sessões do Claude Code. **Leia inteiro antes de agir.**
> Última atualização: 2026-11-11 (sessão 1, concluída com Opus). Depois leia `docs/PLANEJAMENTO.md` (revisão r2).

---

## 1. Situação em uma frase
O app funciona como protótipo (ordens de serviço offline com Supabase). **A construção está em pausa**, aguardando as decisões do planejamento (G0, G1, G2 e G5). O próximo trabalho é a **Fase 0** do plano.

## 2. O projeto
- **Produto:** SaaS B2B multi-cliente de gestão de manutenção predial para imobiliárias, síndicos e prestadores. O modelo de negócio previsto é freemium com take-rate de 10–15% sobre orçamentos e compras (ver `.cursorrules`).
- **Stack:** Next 16 (App Router, só client components), React 19, Dexie (IndexedDB) para offline, Supabase (Postgres, Auth, RLS) e Tailwind 3.
- **Papéis:** `admin`, `manager`, `technician`, `viewer`. Isolamento por `tenant_id`, com RLS.
- **Tela principal:** `src/components/work-orders/WorkOrderManager.tsx` (~1.140 linhas; a quebra em módulos está planejada).
- **Next 16 é diferente do que você conhece:** leia `node_modules/next/dist/docs/` antes de escrever código específico do Next (está no `AGENTS.md`).

## 3. Sobre o usuário (como trabalhar com ele)
- Fala português e é o fundador. Trabalha no Windows com VS Code e GitHub Desktop.
- Gosta de explicações passo a passo e deu **carta branca para mudanças técnicas**. Decisões de **negócio** e de **custo** são dele: pergunte.
- **Restrição firme: custo zero** até haver cliente pagante.
- Prefere **planejar bem antes de construir**, porque retrabalho sai mais caro.
- Usa Opus para planejamento/arquitetura e Sonnet para implementação.

## 4. Localização e git
- **Pasta oficial:** `C:\Users\Desktop\Desktop\PROJETOS TI\fixpro-manutencao-predial`
- A pasta antiga `PROJETOS TI\MANUTENÇÃO_PREDIAL` é uma cópia obsoleta e o usuário vai apagá-la. **Não trabalhar nela.**
- **Remoto:** `github.com/fabsoft86-bot/manuten-opredial`, branch `main`. Os commits são locais e o **push é feito pelo usuário** no GitHub Desktop.
- **Commits desta sessão:**
  - `eabff72`: sync resiliente, SQL 004 e limpeza.
  - `331dfb1`: remove o gitlink `imovel`.
  - `1ad71c3`: PWA.
  - `7f669b3`: correção do HANDOFF.
  - `25ced2e`: planejamento r1.
  - O commit seguinte traz o planejamento r2, o `CLAUDE.md` e este HANDOFF.

## 5. O que já foi feito (sessão 1)
1. **Revisão inicial e correções**
   - `pruneSyncedRecords`: apaga do cache local o que sumiu do servidor.
   - Sync resiliente: um item com erro não trava os outros, e o pull sempre roda.
   - Um sync novo é feito se houver edição durante um sync em andamento.
   - Export `indexedDB` renomeado para `db`.
2. **Migration `supabase/migrations/20261111000004_hardening.sql`:** `search_path` no `set_updated_at` e um trigger que impede `property_id` de outro tenant. **AINDA NÃO APLICADA NO SUPABASE.**
3. **Limpeza:** arquivos vazios da raiz, clone vazio `imovel` e pasta `.cursor`; pacote renomeado para `fixpro-manutencao-predial`; `.cursorrules` atualizado.
4. **PWA (testado em Chrome via CDP, build de produção)**
   - **Instalação:** `src/app/manifest.ts`, ícones em `public/icons/` (gerados a partir de `icon.svg` com `sharp`) e metadata no layout.
   - **Service worker** (`public/sw.js`):
     - cache-first para `/_next/static`;
     - network-first com timeout para HTML;
     - stale-while-revalidate para ícones.
     - Supabase, RSC e API nunca são cacheados.
     - Incremente `VERSION` ao alterá-lo.
     - Só é registrado em produção: teste com `npm run build && npm start`.
   - **`InstallPrompt`:** botão de instalação no Android; instrução de "Adicionar à Tela de Início" no iOS.
   - **Identidade offline** (`src/lib/offlineIdentity.ts`): `AuthGuard` e `TenantContext` usam a última identidade salva quando não há rede. Ela é limpa no logout. Logout offline usa `signOut({ scope: 'local' })`.
   - **Testado:** offline sem identidade vai para `/login`; offline com identidade mostra as ordens com tenant e papel.
   - **Não testado:** login real com Supabase passando por offline e de volta online, e instalação em celular.
5. **Planejamento** (`docs/PLANEJAMENTO.md`, r2): pesquisa de alternativas, decisões e roadmap.

## 6. Decisões já tomadas pelo usuário
- **Conflitos de sync = D + C:**
  - Campos diferentes alterados dos dois lados são mesclados automaticamente.
  - Se os dois lados mudaram o mesmo campo, o usuário escolhe "manter a minha" ou "manter a do servidor".
  - Ordem **apagada no servidor** enquanto editada offline: **avisar o técnico e deixar ele escolher** entre recriar e descartar.
- **Custo zero** até haver cliente pagante.
- **Pausa na construção** até decidir o plano.

## 7. Recomendações do plano r2 (aguardando aprovação; ver seção 10 do plano)
- **G1 — sync: outbox próprio sobre Dexie (opção A)**, com mutações por campo no formato compatível com a fila do PowerSync e aplicação no servidor por uma função SQL `apply_mutation`. Assim dá para migrar ao PowerSync depois sem reescrever o servidor.
  - Motivo: o plano grátis do PowerSync pausa após 7 dias e é mais uma peça.
- **G5 — hospedagem:** **exportação estática** (`output: 'export'`) numa hospedagem gratuita que permita uso comercial. A Vercel Hobby **proíbe uso comercial**.
  - Impactos: os headers do `sw.js` vão para a hospedagem, e `src/app/work-orders/page.tsx` usa `redirect()` e precisa ser revisto.
  - Lógica de servidor fica em Supabase Edge Functions.
- **Manter o Supabase no plano gratuito.** Corrigir o processo: CLI, migrations versionadas, `supabase start`, testes de RLS, SMTP próprio (o padrão manda só 2 e-mails/hora) e backup próprio (o plano grátis não tem backup).
- **Multi-tenancy:** trocar `profiles.tenant_id` por `memberships (user_id, tenant_id, role)` na Fase 1.
- **PWA primeiro.** Capacitor/nativo só com evidência do piloto **e** com receita (portão G3).
- **G2 — persona do MVP** (sugestão): síndico/administradora pequena + zelador, com chamado por link/QR. Depende de **conversas com clientes**, que o usuário precisa fazer.

## 8. Próximos passos (Fase 0, quando o usuário aprovar)
1. Upgrade do Next e do `eslint-config-next`. O `npm audit` acusa uma vulnerabilidade **crítica** no Next 16.0.0–16.4.0 em recursos que não usamos. Depois, revalidar build, lint e o teste offline.
2. Supabase CLI: `supabase init`, converter 001 a 004 em migrations versionadas, `supabase start`, `supabase gen types`. **Remover o `docker-compose.yml`**: ele sobe Postgres puro, mas o schema usa `auth.users`, então não funciona.
3. CI (GitHub Actions) com Vitest, testes de RLS e o smoke offline no Playwright.
4. SMTP próprio com cota gratuita e backup semanal cifrado (`supabase db dump`).
5. Prova da exportação estática e publicação de teste (G5).
6. Fatia vertical do outbox (G1).
- **Não implementar** conflitos D+C, fotos, orçamentos nem pagamentos antes disso.

## 9. Pendências do usuário
- Aprovar ou ajustar o plano (G0) e responder G2 (para quem é o MVP).
- Rodar a migration 004 no Supabase:
  1. Abra o painel do Supabase e entre em **SQL Editor**.
  2. Clique em **New query**.
  3. Cole o conteúdo de `supabase/migrations/20261111000004_hardening.sql`.
  4. Clique em **Run**.
  - Quando adotarmos a CLI, a 004 vira uma migration versionada.
- Dar push dos commits pelo GitHub Desktop.
- Apagar a pasta antiga `MANUTENÇÃO_PREDIAL` depois de abrir a pasta nova no VS Code.

## 10. Armadilhas conhecidas (para não repetir)
- **`next build` para na primeira tentativa** com um aviso de segurança e pede para rodar `next upgrade --agent=security`. Repetir o build continua normalmente. **Não rode** o upgrade sugerido pela saída da ferramenta sem o usuário aprovar.
- **Bash com heredoc ou `node -e` contendo acentos graves** (\`) dentro de aspas duplas executa substituição de comando. Isso já corrompeu este arquivo uma vez. Prefira a ferramenta Write/Edit para editar texto.
- **Windows:** a pasta aberta no VS Code fica bloqueada (não dá para mover nem apagar). O shell do Bash às vezes volta para outra pasta, então use caminhos absolutos.
- **Teste offline real:** há um script de exemplo que dirige o Chrome via CDP (`--remote-debugging-port`) e simula offline com `Network.emulateNetworkConditions`. Ele não está no repositório; recrie em `scratchpad` se precisar.
- **Supabase grátis pausa após 7 dias sem uso.** Se der erro de conexão, verifique no painel se o projeto está pausado.

## 10b. Supabase em uso (atualizado em 2026-11-13)
- **Projeto oficial:** `gofinznitroahbspsrqn`. O `.env.local` aponta para ele e usa a chave *publishable* (`sb_publishable_…`). A `sb_secret_…` nunca entra no app.
- O projeto antigo `xfwvaxgqpfaoowebweuh` ficou para trás (o usuário vai apagar ou pausar). Não usar.
- As migrations 002, 003 e 004 **já foram aplicadas** no projeto oficial. Existem o usuário `fabsoft86@gmail.com` (admin), o tenant "FabSoft" e o perfil. O login local foi confirmado pelo usuário.
- Senha de teste fraca (`123321`): trocar antes de ter clientes.
- O projeto grátis pausa por inatividade. Para retomar: painel, **Resume project**.
- Erro "Invalid login credentials" com usuário existente = quase sempre projeto Supabase errado: compare o código na URL do painel com o do `.env.local`.

## 11. Notas
- `.env.local` tem as chaves do Supabase e um `VERCEL_OIDC_TOKEN` e está no `.gitignore`. Nunca coloque `service_role` em `NEXT_PUBLIC_*`.
- Verificações: `npx tsc --noEmit` e `npm run lint` (passam no último commit).
- Regra do projeto (`.cursorrules`): não alterar layout nem regra de negócio sem validação; planejar antes de grandes refatorações.
