# FixPro — Avaliação de arquitetura e planejamento

Data: 2026-11-11 · Status: **proposta para decisão** (nenhuma implementação nova até as decisões G0–G2 abaixo).

> Como ler: cada afirmação traz o grau de confiança.
> **[Código]** verificado no repositório · **[Oficial]** documentação do fornecedor · **[Secundária]** blog/comparativo (pode ser opinião ou marketing) · **[Inferência]** conclusão minha.
> A pesquisa de mercado brasileiro foi rasa (fontes antigas). Ela **não substitui** conversar com clientes (ver Fase 0).

---

## 1. Resposta curta às três perguntas

**"Essa é a melhor forma de fazer uma ferramenta como essa?"**
A *categoria* de stack está certa (Postgres + Auth + RLS, front web instalável, dados locais para offline). Mas três coisas estão fracas e uma está faltando:
1. **Sincronização feita à mão** (Dexie + push/pull manual + "último a enviar ganha"). É a parte mais arriscada do sistema e onde a indústria recomenda *não* reinventar.
2. **Modelo de dados fino demais para o modelo de negócio.** O negócio é monetizar orçamentos/compras de prestadores, mas hoje não existem prestadores, orçamentos, anexos, histórico nem usuário em vários clientes.
3. **Processo de engenharia ausente:** sem testes, sem CI, migrations aplicadas à mão, ambiente local que não roda.
4. **Falta o produto:** ainda não definimos para quem é o MVP nem qual é o "gancho" que o torna legal.

**"Esse é o melhor uso do que temos?"**
Em parte. Next.js hoje é usado só como casca estática (zero código de servidor [Código]). Isso é aceitável, mas só se justifica de verdade quando entrarem webhooks, chamados públicos por QR e o painel do gestor. Supabase está bem usado no conceito (RLS, funções com `search_path` fixo) e mal usado no processo.

**"Se mudássemos o que temos, teria um uso melhor?"**
Trocar o Supabase por outra coisa **não** compensa: as alternativas que parecem mais simples (Firebase, Convex, PocketBase) abrem mão de SQL relacional, RLS ou de offline correto, que são justamente o que o negócio (financeiro, multi-cliente) pede. O que realmente vale testar é **acrescentar** um motor de sincronização (PowerSync) por cima do mesmo Postgres, e decidir com um spike, não por opinião. A incomodação com o Supabase vem, em boa parte, de como o estamos usando (seção 4, P4).

---

## 2. Diagnóstico do que existe (fatos)

| Área | Situação | Fonte |
|---|---|---|
| Front | Next 16, React 19, 100% client components, sem Server Actions/rotas de API | Código |
| Offline | Dexie; push/pull manual; LWW; pull baixa **todas** as ordens a cada sync; sem tombstones/cursor | Código |
| PWA | manifest + service worker + identidade offline (feito nesta sessão, testado em Chrome) | Código |
| Dados | 4 tabelas (tenants, profiles, properties, work_orders); 1 usuário = 1 tenant | Código |
| Mídia | **Inexistente** (o commit antigo cita upload de mídias, mas não há código) | Código |
| Orçamentos / prestadores / pagamentos | **Inexistentes**, apesar de serem a monetização | Código + `.cursorrules` |
| Migrations | Aplicadas à mão no SQL Editor | SETUP.md |
| Ambiente local | `docker-compose` sobe **Postgres puro**, mas o schema usa `auth.users` e `auth.uid()` → não funciona | Código |
| Testes / CI | Nenhum | Código |
| Segurança de deps | `npm audit`: **1 crítica** em Next 16.0.0–16.4.0 (RCE em otimização de imagem SVG, DoS em Server Actions, RCE em `use cache`). Não usamos essas três features, então a exposição real é baixa, mas a correção é barata | Código (`npm audit`) |
| Tamanho | `WorkOrderManager.tsx` com ~1.140 linhas misturando UI, sync e regras | Código |

---

## 3. Princípios que guiam as decisões

1. **Evitar retrabalho** (seu pedido): decidir sync e modelo de dados *antes* de construir conflitos, anexos e orçamentos em cima.
2. **O servidor é a autoridade**; o aparelho é um cache otimista com fila de mudanças (outbox).
3. **Segurança no banco** (RLS), testada automaticamente. O front só reflete.
4. **Comprar o que é commodity** (auth, storage, sync, pagamento), construir só o que diferencia (fluxo de chamado→orçamento→aprovação para o nosso público).
5. **Validar com usuários reais cedo.** Sincronização perfeita sem cliente não paga conta.

---

## 4. As perguntas, as respostas e o veredito

### P1. Qual é o produto mínimo e quem paga? (a pergunta mais importante)
- Mercado: há ferramentas de condomínio generalistas no Brasil (AlmahCondos, Unitify, Doctor Condo, Group Software) e de manutenção/chamados (In Motion CONDOS, Produttivo); no exterior, MaintainX/UpKeep/Limble com app móvel offline forte. **[Secundária]** — fontes brasileiras de 2020–2022, sem dados de participação.
- Indício de espaço: muitos produtos são generalistas; manutenção + cotação com prestadores parece menos coberta. **[Inferência]**
- Risco do modelo "take-rate de 10–15%": é um **marketplace** (precisa de prestadores *e* clientes; problema do ovo e da galinha), exige KYC/subcontas, notas fiscais e tributação. **[Inferência]** — validar com contador antes de prometer.
- **Veredito:** o MVP deve provar primeiro o **fluxo de chamado até a conclusão** com *um* perfil (síndico/administradora pequena + zelador/técnico). Orçamentos vêm depois; pagamento com split por último.

### P2. O banco/backend: Supabase é a escolha certa?
- Postgres relacional é o encaixe natural para dados multi-cliente e financeiros. As alternativas: Firebase (NoSQL, lock-in), Convex (modelo diferente, foco em tempo real online), PocketBase (SQLite, serve a servidor único, não a multi-tenant grande), Appwrite (mais operação ao auto-hospedar), Neon (só o banco: auth e storage ficam por nossa conta). **[Secundária]**
- Trocar custaria reescrever RLS e auth. **[Secundária]**
- **Por que parece "chato"? Causas no *nosso* uso:** (a) migrations pelo painel em vez da CLI (a própria doc diz que isso causa erros de histórico no `db push`) **[Oficial]**; (b) ambiente local falso (docker Postgres puro); (c) RLS sem testes automatizados; (d) plano grátis pausa por inatividade (7 dias) e tem limites baixos **[Secundária — confirmar em supabase.com/pricing]**; (e) confirmação de e-mail no Auth.
- **Veredito: manter.** Corrigir o processo: Supabase CLI + `supabase start` + migrations versionadas + tipos gerados + testes de RLS (pgTAP). Plano Pro (~US$ 25/mês **[Secundária]**) assim que houver cliente real.

### P3. Multi-tenancy: o modelo atual aguenta o negócio?
- Hoje `profiles.tenant_id` liga **um** usuário a **um** tenant **[Código]**. O próprio modelo de negócio (administradoras com vários condomínios; prestadores atendendo vários clientes; técnicos em mais de uma empresa) quebra isso. **[Inferência, forte]**
- Padrão recomendado: tabela `memberships (user_id, tenant_id, role)`; tenant ativo escolhido na sessão.
- Claims no JWT (Custom Access Token Hook) deixam a RLS mais rápida, mas **revogar acesso só vale quando o token renova**; consultar a tabela de membership dá revogação imediata, ao custo de uma consulta por linha avaliada. A doc oficial recomenda `(select auth.uid())`, índice nas colunas das policies, `TO authenticated` e filtros explícitos no cliente. **[Oficial]** Para o MVP (volumes pequenos) manter a função `current_tenant_id()` baseada em tabela é suficiente; migrar para claims só se a medição mostrar necessidade. **[Inferência]**
- **Veredito: refatorar para memberships já na Fase 1** (mudar isso depois, com dados em produção, é caro).

### P4. Sincronização offline: a abordagem atual é a melhor?
Estado atual: sincronização manual, LWW, sem cursor incremental, sem tombstones, relógio do cliente.

| Opção | Como funciona | Prós | Contras | Veredito |
|---|---|---|---|---|
| **A. Manter e endurecer (Dexie + outbox próprio)** | Fila de mutações, `version` do servidor, pull por cursor, `deleted_at` | Sem peça nova; total controle | Nós mantemos a parte mais difícil; mais código e bugs sutis; offline de mídia à parte | Plano B |
| **B. PowerSync + Supabase** | SQLite local sincronizado por *sync rules* (por tenant/papel); fila de escritas enviada ao nosso backend (`uploadData`), onde nós decidimos conflitos | Sync incremental/parcial pronto; SDK web e **React Native** (caminho p/ app nativo); a doc já trata conflito como regra de negócio nossa; Edição free/Starter e Open Edition auto-hospedável **[Oficial/Secundária]** | Mais uma peça operacional; SDK web exige `wa-sqlite` e roda só no cliente (sem SSR) — aceitável; Open Edition é licença FSL, não OSI; não resolve conflito sozinho **[Oficial]** | **Candidato favorito** (a validar no spike) |
| C. Dexie Cloud | Backend de sync próprio da Dexie | Encaixa no Dexie atual | Os dados passam a viver no Dexie Cloud, **não** no nosso Postgres → ruim para relatórios, financeiro e RLS | Descartar |
| D. ElectricSQL | Sincroniza leituras do Postgres; escrita fica na nossa API | Leve | Só leitura **[Secundária]**; relatos de mudança corporativa (Databricks) e fim do serviço hospedado **[Secundária, confirmar]** | Descartar por ora |
| E. Zero (Rocicorp) | Sync para web, só Postgres | 1.0 lançado; bom DX **[Secundária]** | Só web (sem nativo), jovem, escrita por *mutators* no servidor | Observar |
| F. RxDB | Biblioteca JS com replicação | Flexível | Plugins avançados pagos; consistência eventual por documento **[Secundária]** | Reserva |
| G. Convex / Firebase | Tempo real online-first / NoSQL | Simples para começar | Offline não é o ponto forte (Convex); NoSQL/lock-in (Firebase) | Descartar |

Ponto-chave: **a regra D+C que você aprovou (mescla por campo + perguntar) precisa de "mudanças por campo + versão base".** Num motor como o PowerSync, a fila de escrita já registra *quais campos* mudaram **[Inferência — confirmar na doc de CRUD]**, o que entrega metade da regra D quase de graça; o "C" (perguntar ao usuário) é uma tabela de conflitos + tela, em qualquer opção.
**Consequência prática: pausar a implementação de conflitos até o spike decidir A ou B**, para não construir duas vezes.

**Veredito:** fazer um **spike de 2–3 dias** (critérios na seção 7, Fase 0) e decidir com dados. Inclinação atual: **B**.

### P5. PWA ou aplicativo nativo para o técnico?
- iOS: Web Push só com app instalado (16.4+); **sem Background Sync** (o envio acontece ao reabrir o app); armazenamento pode ser limpo após ~7 dias sem uso, com relatos divergentes se instalar na tela inicial isenta; cota menor fora do modo instalado. **[Secundária — validar em aparelho real]**
- Android/Chrome: instalável, Background Sync disponível, persistência mais previsível. **[Secundária/conhecimento geral]**
- Fotos offline com envio em segundo plano são o ponto frágil do PWA no iOS. A recomendação recorrente é escolher nativo/híbrido quando offline e background são centrais. **[Secundária]**
- Supabase Storage tem **upload resumável (TUS)** com retomada, URL válida por 24 h (exige novo URL se passar disso) e chunk fixo de 6 MB. **[Oficial]**
- Participação do Android no Brasil costuma ser muito majoritária, mas **não verifiquei** nesta pesquisa. **[Confirmar]**
- **Veredito:** **PWA primeiro** (já temos), tratando o armazenamento local como *cache* e a nuvem como verdade; **portão G3**: se no piloto houver perda de fotos/dados no iOS ou muitos técnicos iPhone, embrulhar com **Capacitor** (reaproveita o código web) ou criar app **Expo** reaproveitando o mesmo motor de sync (PowerSync tem SDK RN). Não construir nativo agora.

### P6. Next.js: é a ferramenta certa para um PWA offline?
- Hoje funciona, mas para o app do técnico um SPA (Vite + service worker/Workbox) seria mais simples e previsível. **[Inferência]**
- Porém o produto terá: painel do gestor, página pública de chamado por QR/link, webhooks de pagamento e rotas seguras com `service_role` — tudo isso é onde Next (rotas de servidor, Vercel) agrega. **[Inferência]**
- **Veredito: manter Next**; subir a versão corrigida; usar o servidor só onde precisa (chamado público, webhooks, PDFs). Não investir em RSC/`use cache` para o app offline.

### P7. Arquitetura do código: está organizada para crescer?
- Está parcialmente: há repositórios e serviços, mas a tela principal concentra UI + sync + regras. Sem validação de entrada, sem cache de consulta, tipos escritos à mão em vez de gerados.
- Alvo: **módulos por funcionalidade** (`features/work-orders`, `features/properties`, `features/sync`), regras de domínio puras e testáveis, validação com Zod nas bordas, tipos gerados (`supabase gen types`), camada de dados única (consultas reativas do motor escolhido).
- **Veredito:** refatorar **junto** com a Fase 1/2, não como tarefa isolada.

### P8. Qualidade, segurança e operação
- Itens que faltam e são baratos: CI (tsc + lint + build + testes), Vitest (regras de domínio e sync), **testes de RLS** (um usuário de outro tenant não lê/escreve), Playwright (smoke offline), Sentry/observabilidade, upgrade do Next, backups e rotina de restauração (plano Pro).
- Dados pessoais: fotos de residências, nomes de moradores/técnicos → **LGPD** (base legal, retenção, exclusão, contrato de operador). **[Inferência]** — validar com assessoria jurídica; não é parecer.
- **Veredito:** entra na Fase 0 (CI/testes) e na Fase 3 (LGPD, antes do piloto).

### P9. Pagamentos e take-rate
- Asaas usa **subcontas** por recebedor e `walletId` para o split; Pagar.me/Stripe/Juno têm split nativo. Para **Pix** em split, a doc da Cielo diz que o split precisa ocorrer na própria venda (sem split pós-transação). **[Secundária]** Taxas/take-rate publicados: não encontrei; **consultar tabelas oficiais**. Cada prestador vira subconta com KYC (atrito de onboarding).
- **Veredito:** não construir pagamento no MVP. Fase 4: orçamento aprovado + cobrança manual; Fase 5: split.

---

## 5. Arquitetura alvo (proposta)

```
 Solicitante (link/QR, sem login)  ──►  Next.js (rota pública + captcha/rate-limit)
                                              │ service_role (só no servidor)
 Técnico (PWA Android/iOS)  ─┐                 ▼
 Gestor (web)               ─┼─► Motor local (SQLite via PowerSync* ou Dexie+outbox)
                             │         │ fila de escritas / sync incremental
                             │         ▼
                             └──►  Supabase: Auth ─ Postgres (RLS + memberships) ─ Storage (TUS)
                                         │                         │
                                   Edge/Route handlers        Realtime opcional
                                   (webhooks, PDFs, e-mail/push)
                                         │
                                  Pagamentos (Fase 5: Asaas/Pagar.me, split)
   * decisão do spike (G1). Mídia sobe por fila própria (TUS), fora do sync de linhas.
```

## 6. Modelo de dados alvo (esboço)

- `tenants` (cliente pagante: administradora/imobiliária/síndico) · `memberships (user_id, tenant_id, role)`
- `properties` (+ `units`/locais) · `assets` (equipamentos; Fase 2+)
- `work_orders` (+ `assignee_id`, `due_at`, `category`, `origin` corretiva/preventiva, `requester`, `deleted_at`, `version`)
- `work_order_events` (linha do tempo/auditoria, só-inserção) · `attachments` (caminho no Storage, ordem, tipo)
- `vendors` (prestadores) → `quotes` (orçamentos) → `approvals` (Fase 4) · `payments` (Fase 5)
- Regras: `deleted_at` em vez de DELETE (tombstones p/ sync); `version`/`updated_at` **controlados pelo servidor**; RLS por `memberships`; Storage com caminho `tenant_id/...` e policy equivalente.

## 7. Roadmap por fases (com critérios de saída)

Estimativas são ordem de grandeza para 1 desenvolvedor com assistência de IA; **recalibrar após a Fase 0**.

**Fase 0 — Fundação e decisões (~1–1,5 semana)**
1. `npm audit fix` / upgrade do Next + `eslint-config-next`; revalidar build, lint e o teste offline.
2. Supabase CLI: `supabase init`, migrations versionadas (converter 001–004), `supabase start` local, tipos gerados; **remover o docker-compose falso**.
3. CI (GitHub Actions): tsc, lint, build, testes. Vitest + testes de RLS (pgTAP ou script SQL) + 1 teste Playwright offline.
4. Sentry (ou equivalente) e ADRs curtos das decisões abaixo.
5. **Spike de sync (2–3 dias):** PowerSync (Cloud grátis) + Supabase + Next 16 (há guia oficial p/ Turbopack) vs. esboço do outbox próprio. Critérios: (a) edição offline→online correta; (b) 2 aparelhos editando o mesmo campo e campos diferentes; (c) 500+ ordens sem sync lento; (d) peso do bundle e carga do `wa-sqlite`; (e) funciona em Android real e iOS real (reabrir após dias, conferir se perdeu dados); (f) como ficam fotos (fila TUS separada); (g) esforço de operação/custo.
6. **Descoberta com clientes (em paralelo):** 5–10 conversas com síndicos/administradoras/zeladores: dores, ferramentas atuais, quanto pagariam, quem aprova orçamento.
- **Saída:** CI verde; ambiente local reproduzível; **G1 (sync)** e **G2 (persona/gancho do MVP)** decididos.

**Fase 1 — Núcleo de dados e organização (~2 semanas)**
- Memberships + seleção de tenant; `deleted_at`; `version` servidor; `work_order_events`; `assignee`/`due_at`; Custom Access Token Hook só se medido.
- Quebrar `WorkOrderManager` em módulos por funcionalidade; Zod nas bordas.
- **Saída:** mesma funcionalidade de hoje, agora multi-cliente, testada (RLS e domínio).

**Fase 2 — Sync definitivo + conflitos + mídia (~2–3 semanas)**
- Implementar o motor escolhido em G1; regra de conflitos D+C (campos diferentes mesclam; mesmo campo pergunta; **ordem apagada no servidor → avisar e deixar o técnico escolher**, já decidido).
- Fotos: captura, compressão no cliente, fila resumável (TUS), miniaturas; limite de armazenamento local e limpeza.
- **Saída:** cenários de conflito e de fotos passam em teste automatizado e em dois aparelhos reais.

**Fase 3 — MVP de piloto (~2–3 semanas)**
- Chamado por link/QR sem login (anti-abuso), triagem e atribuição, execução em campo, encerramento com aprovação, relatório por imóvel (CSV/PDF), notificações (e-mail; push no Android), onboarding de novo cliente (cadastro cria tenant via função), LGPD básica (termos, exclusão, retenção).
- Plano do Supabase em **Pro**; backups; monitoramento.
- **Saída:** 1–3 clientes reais em piloto gratuito; medir: chamados/semana, tempo até conclusão, fotos enviadas, falhas de sync, uso offline.

**Fase 4 — Orçamentos e prestadores (~3 semanas)** · **Fase 5 — Pagamentos/split e take-rate** · **Portão G3 (nativo/Capacitor)** conforme dados do piloto.

## 8. Decisões a tomar (e quando)

| # | Decisão | Quando | Recomendação atual |
|---|---|---|---|
| G0 | Aprovar este plano e a pausa em novos recursos | Agora | Sim |
| G1 | Motor de sync: PowerSync vs. outbox próprio | Fim do spike (Fase 0) | PowerSync, se passar nos critérios |
| G2 | Persona e gancho do MVP | Fim da descoberta (Fase 0) | Síndico/administradora pequena + zelador; chamado por QR |
| G3 | PWA continua ou vira Capacitor/Expo | Após piloto (Fase 3) | PWA até haver evidência |
| G4 | Modelo de cobrança (assinatura × take-rate) | Antes da Fase 4 | Piloto grátis; decidir com dados |

## 9. Riscos principais

1. **Construir demais antes de validar** → mitigação: Fase 0 de descoberta, piloto na Fase 3.
2. **iOS reduz a confiabilidade do offline** (sem Background Sync, evicção) → portão G3 e testes em aparelho real.
3. **Dependência de peça extra (PowerSync)** → spike com plano B documentado; dados continuam no nosso Postgres, então a saída é possível.
4. **Marketplace sem liquidez e com carga fiscal/KYC** → só na Fase 4–5, com contador/jurídico.
5. **Vazamento entre clientes** → testes de RLS no CI desde a Fase 0.

## 10. Lacunas desta pesquisa (verificar antes de decidir)
- Preços e limites atuais (Supabase, PowerSync) vêm de blogs; conferir nas páginas oficiais.
- Detalhes de iOS (evicção com app instalado, Background Sync) divergem entre fontes; **testar em aparelho real**.
- Mercado brasileiro: sem dados de participação ou preços atuais; fazer a descoberta com clientes.
- Participação Android/iOS entre técnicos brasileiros: não verificada.
- Notícias sobre ElectricSQL/Databricks e maturidade do web SDK do PowerSync: confirmar nas fontes oficiais.

## Fontes
- Comparativos de motores de sync (secundárias): [Offline-First Data & Sync](https://progressivewebapps.com/architecture/offline-first/), [ElectricSQL vs PowerSync vs Replicache](https://queryplane.com/blog/electricsql-vs-powersync-vs-replicache/), [ElectricSQL vs PowerSync vs Zero (2026)](https://trybuildpilot.com/648-electric-sql-vs-powersync-vs-zero-2026), [Offline-First Mobile Architecture 2026](https://frenchydigital.com/blog/offline-first-mobile-architecture-2026), [Zero 1.0 — InfoQ](https://infoq.com/news/2026/06/zero-version-1)
- PowerSync (oficial): [Conflitos customizados](https://docs.powersync.com/handling-writes/custom-conflict-resolution), [Supabase + PowerSync](https://docs.powersync.com/integration-guides/supabase-+-powersync), [Next.js](https://docs.powersync.com/client-sdks/frameworks/next-js), [Preços](https://powersync.com/pricing), [Licenciamento](https://powersync.com/legal/licensing-terms), [Persistência SQLite na web](https://powersync.com/blog/sqlite-persistence-on-the-web)
- Dexie Cloud: [Consistência](https://dexie.org/cloud/docs/consistency), [Produto](https://dexie.org/product)
- PWA/iOS (secundárias): [PWA iOS Limitations](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide), [iOS PWA Compatibility](https://firt.dev/notes/pwa-ios/), [Fórum Apple — Background Sync](https://developer.apple.com/forums/thread/694805)
- Nativo vs PWA: [PWA vs Native vs React Native (2026)](https://www.buildmvpfast.com/blog/pwa-vs-native-vs-react-native-solo-founder-decision-2026), [React Native vs Expo vs Capacitor](https://www.pkgpulse.com/guides/react-native-vs-expo-vs-capacitor-cross-platform-mobile-2026)
- Supabase (oficial): [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Desempenho de RLS](https://supabase.com/docs/guides/database/postgres/row-level-security-performance), [Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook), [Custom Claims & RBAC](https://supabase.com/docs/guides/api/custom-claims-and-role-based-access-control-rbac), [Migrations](https://supabase.com/docs/guides/deployment/database-migrations), [Fluxo local](https://supabase.com/docs/guides/local-development/cli-workflows), [Uploads resumáveis](https://supabase.com/docs/guides/storage/uploads/resumable-uploads)
- Supabase (secundárias): [Alternativas 2026](https://dev.to/max4nhost/supabase-alternatives-in-2026-6of), [Preços 2026](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/), [RLS multi-tenant](https://dev.to/kanta13jp1/supabase-rls-deep-dive-multi-tenant-design-dynamic-policies-and-performance-4adk)
- Mercado e pagamentos: [Sindiconet — manutenção na palma da mão](https://www.sindiconet.com.br/informese/manutencao-do-condominio-na-palma-da-mao-mercado-coluna-de-olho-no-mercado), [Unitify](https://unitify.com/brazil), [Asaas — split](https://blog.asaas.com/split-de-pagamento/), [Asaas — FAQ do split](https://docs.asaas.com/docs/faq-do-split), [Cielo — Pix em split](https://docs.cielo.com.br/split/v1.0-en/docs/pix-1)
- CMMS: [Reliable — melhores CMMS 2026](https://reliamag.com/guides/best-cmms-software-2026/), [MaintainX vs Limble](https://reliamag.com/topics/cmms/maintainx-vs-limble)
