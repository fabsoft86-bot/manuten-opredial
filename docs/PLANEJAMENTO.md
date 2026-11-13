# FixPro — Avaliação de arquitetura e planejamento

**Status:** proposta para decisão. Nenhuma funcionalidade nova até as decisões G0–G2.
**Restrição do dono do produto:** **custo zero** até existirem clientes pagantes que justifiquem qualquer upgrade.

| Revisão | Data | O que mudou |
|---|---|---|
| r1 | 2026-11-11 | Primeira versão (pesquisa + roadmap). |
| r2 | 2026-11-11 | Revisão com a restrição de custo zero. **Duas recomendações mudaram:** (1) sync: o outbox próprio passa a ser o padrão e o PowerSync vira opção futura; (2) hospedagem: exportação estática em vez de depender do Vercel Hobby, que proíbe uso comercial. Novas seções 4 e 9. |

> **Como ler:** cada afirmação traz o grau de confiança.
> - **[Código]** verificado no repositório.
> - **[Oficial]** documentação do fornecedor.
> - **[Secundária]** blog ou comparativo (pode ser opinião ou marketing).
> - **[Inferência]** conclusão minha.
>
> A pesquisa do mercado brasileiro foi rasa (fontes de 2020 a 2022) e **não substitui** conversar com clientes (Fase 0).

---

## 1. Resposta curta às três perguntas

**"Essa é a melhor forma de fazer uma ferramenta como essa?"**
A categoria de stack está certa: Postgres com RLS, app web instalável e dados locais para offline. Há três fraquezas e uma lacuna:
1. **A sincronização foi feita à mão e ingenuamente:** "último a enviar ganha", download de tudo a cada sync, sem registro de exclusões e usando o relógio do aparelho.
2. **O modelo de dados é fino demais para o negócio.** Não existem prestadores, orçamentos, fotos nem histórico, e cada usuário pertence a um único cliente.
3. **Falta processo:** sem testes, sem CI, migrations aplicadas à mão e um ambiente local que não funciona.
4. **Falta definir o produto:** para quem é o MVP e qual é o "gancho" dele.

**"Esse é o melhor uso do que temos?"**
Em parte.
- **Next.js** hoje é só uma casca estática, sem nenhum código de servidor [Código]. Com custo zero, isso vira vantagem: o app pode ser publicado como site estático em hospedagem gratuita (P6).
- **Supabase** está bem usado no conceito e mal usado no processo.

**"Se mudássemos o que temos, teria um uso melhor?"**
Trocar o Supabase não compensa. As alternativas "mais simples" (Firebase, Convex, PocketBase) abrem mão de SQL relacional, de RLS ou de offline correto, e é disso que um produto financeiro e multi-cliente precisa. O que muda de verdade:
- **Manter o banco e endurecer a sincronização**, num formato que permita trocar por um motor pronto (PowerSync) no futuro sem reescrever o servidor.
- **Publicar o front como site estático** para não pagar hospedagem.

---

## 2. Diagnóstico do que existe (fatos)

| Área | Situação | Fonte |
|---|---|---|
| Front | Next 16 e React 19, só client components; sem Server Actions nem rotas de API | Código |
| Offline | Dexie com push/pull manual e LWW; o pull baixa **todas** as ordens a cada sync; sem tombstones nem cursor | Código |
| PWA | Manifest, service worker e identidade offline, testados no Chrome | Código |
| Dados | 4 tabelas (tenants, profiles, properties, work_orders); 1 usuário = 1 tenant | Código |
| Mídia | **Inexistente** (um commit antigo cita upload de mídia, mas não há código) | Código |
| Orçamentos, prestadores e pagamentos | **Inexistentes**, apesar de serem a fonte de receita | Código + `.cursorrules` |
| Migrations | Aplicadas à mão no SQL Editor | SETUP.md |
| Ambiente local | O `docker-compose` sobe Postgres puro, mas o schema usa `auth.users` e `auth.uid()`, então não funciona | Código |
| Testes e CI | Nenhum | Código |
| Dependências | `npm audit` acusa **1 crítica** no Next 16.0.0–16.4.0: RCE na otimização de imagem SVG, DoS em Server Actions e RCE em `use cache`. Não usamos nenhum desses recursos, e com exportação estática não há servidor Next exposto. A correção é barata | Código |
| Tamanho | `WorkOrderManager.tsx` tem cerca de 1.140 linhas misturando UI, sync e regras | Código |

---

## 3. Princípios que guiam as decisões

1. **Custo zero até haver receita.** Toda peça precisa caber num plano gratuito, ou ter um gatilho claro de quando passa a ser paga.
2. **Evitar retrabalho:** decidir a sincronização e o modelo de dados *antes* de construir conflitos, anexos e orçamentos em cima deles.
3. **O servidor é a autoridade.** O aparelho é um cache otimista com uma fila de mudanças (outbox).
4. **Segurança no banco (RLS), com testes automáticos.** O front só reflete as permissões.
5. **Poucas peças móveis.** Cada serviço gratuito a mais é mais um que pode pausar ou mudar de regra.
6. **Validar com usuários reais cedo.**

---

## 4. Restrição de custo zero: o que cabe no gratuito

| Peça | Plano gratuito (o que importa) | Risco | Mitigação | Quando pagar |
|---|---|---|---|---|
| **Supabase** | 2 projetos ativos; banco de ~500 MB; storage de 1 GB (fontes divergem: 500 MB ou 1 GB); egress de ~5 GB [Secundária]. **Pausa após 7 dias sem atividade** [Oficial] | Pausa em períodos parados; **sem backup automático** [Oficial]; o backup não inclui os arquivos do Storage [Oficial] | Piloto com uso diário não pausa. Backup próprio semanal com `supabase db dump` (com dados) via CI, cifrado. Fotos comprimidas no aparelho (~200–300 KB cada). Reativar manualmente se pausar | Com cliente pagante, ou se o banco/storage passar de ~70% do limite. Pro custa ~US$ 25/mês [Secundária] |
| **E-mail de Auth** | O SMTP padrão manda só **2 e-mails/hora**, e só para membros do time [Secundária, várias fontes] | Cadastro e recuperação de senha quebram com clientes reais | **SMTP próprio** (permitido no plano grátis) com um provedor de cota gratuita, como Brevo ou Resend. Limite padrão do Supabase com SMTP próprio: 30/hora, ajustável [Oficial] | Só se o volume passar da cota gratuita |
| **Hospedagem do front** | Vercel Hobby: **apenas uso pessoal, não comercial** [Oficial]. Staff da Vercel aceita protótipo que não cobra [Secundária, fórum] | Ao cobrar o cliente, o plano viola os termos | **Exportação estática** (`output: 'export'`) numa hospedagem gratuita que permita uso comercial, como Cloudflare Pages [**confirmar termos**]. A Vercel Hobby só serve durante o desenvolvimento | Só se precisarmos de servidor Next. Vercel Pro custa ~US$ 20/mês [Inferência — confirmar] |
| **Lógica de servidor** (chamado por QR, webhooks, PDF) | Supabase Edge Functions (cota gratuita mensal) [**confirmar cota**] | Cota | Usar só no essencial | Ao exceder a cota |
| **Sync com PowerSync (se adotado)** | 50 clientes simultâneos, 2 GB sincronizados/mês, 500 MB hospedados; **pausa após 7 dias** sem deploys ou conexões e é desativado depois de 1 a 2 semanas (fontes divergem) [Oficial] | É uma segunda peça que pausa | Por isso deixou de ser o padrão (P4) | Pro custa ~US$ 49/mês [Secundária] |
| **Erros e monitoramento** | Sentry com plano gratuito para desenvolvedor [Inferência — confirmar cota] | Cota de eventos | Amostragem | Só se faltar |
| **CI** | GitHub Actions: gratuito em repositório público, com cota mensal de minutos em repositório privado [Inferência — confirmar] | Cota de minutos | Pipeline enxuto | Raramente |
| **Anti-abuso no chamado público** | Cloudflare Turnstile (gratuito) [Inferência — confirmar] | — | — | — |
| **Pagamentos (Fase 5)** | Asaas e similares cobram por transação, sem mensalidade [Secundária — confirmar tabela] | Taxa por transação | Repassar no preço ou no take-rate | Pago só quando há transação, ou seja, com receita |
| **Domínio** | Subdomínio gratuito da hospedagem | Aparência menos profissional | Comprar domínio (~R$ 40/ano) só no piloto pago | Opcional |

**Conclusão:** o MVP e um piloto gratuito cabem em **R$ 0/mês**, desde que (a) o front seja estático, (b) o SMTP seja próprio com cota grátis, (c) façamos o nosso próprio backup e (d) não acrescentemos peças que pausam. O primeiro custo real esperado é o **Supabase Pro**, quando houver cliente pagante.

---

## 5. As perguntas, as respostas e o veredito

### P1. Qual é o produto mínimo e quem paga? (a pergunta mais importante)
- **Mercado:** há ferramentas de condomínio generalistas no Brasil (AlmahCondos, Unitify, Doctor Condo, Group Software) e de manutenção e chamados (In Motion CONDOS, Produttivo). No exterior, MaintainX, UpKeep e Limble têm app móvel offline forte. [Secundária]
- **Indício de espaço:** manutenção combinada com cotação junto a prestadores parece menos coberta. [Inferência]
- **Risco do take-rate de 10–15%:** é um marketplace. Precisa de prestadores *e* clientes ao mesmo tempo, exige subcontas com KYC e envolve nota fiscal e tributação. [Inferência — validar com contador]
- **Veredito:**
  - O MVP prova o fluxo **chamado → atribuição → execução em campo → conclusão aprovada**, para um único perfil de cliente.
  - Orçamentos vêm depois. Pagamento com split vem por último.
  - Piloto **gratuito** com 1 a 3 clientes.

### P2. Backend: o Supabase é a escolha certa?
- **Encaixe:** o Postgres relacional é o modelo natural para dados multi-cliente e financeiros. [Inferência]
- **Alternativas:** [Secundária]
  - Firebase: NoSQL e lock-in.
  - Convex: focado em tempo real com conexão.
  - PocketBase: SQLite num único servidor.
  - Appwrite: mais operação ao auto-hospedar.
  - Neon: só o banco; auth e storage ficariam por nossa conta.
- **Por que parece "chato" (causas no nosso uso):**
  - (a) Migrations pelo painel. A documentação oficial diz que isso quebra o `db push`. [Oficial]
  - (b) Ambiente local falso.
  - (c) RLS sem testes.
  - (d) Pausa por inatividade no plano grátis. [Oficial]
  - (e) E-mail padrão com limite de 2/hora. [Secundária]
- **Veredito: manter, no plano gratuito.** Corrigir o processo: Supabase CLI, `supabase start` local, migrations versionadas, tipos gerados, testes de RLS, SMTP próprio e backup próprio.

### P3. Multi-tenancy: o modelo atual aguenta o negócio?
- **Hoje:** `profiles.tenant_id` liga um usuário a um único tenant. [Código]
- **Problema:** administradoras têm vários condomínios, prestadores atendem vários clientes e técnicos podem trabalhar em mais de uma empresa. O modelo atual não comporta isso. [Inferência, forte]
- **Padrão recomendado:** `memberships (user_id, tenant_id, role)`, com o tenant ativo escolhido na sessão.
- **Claims no JWT × consulta à tabela:**
  - Claims (Custom Access Token Hook) deixam a RLS mais rápida, mas a revogação só vale quando o token renova.
  - A consulta à tabela revoga na hora.
  - Boas práticas oficiais: `(select auth.uid())`, índice nas colunas das policies, `TO authenticated` e filtro explícito também no cliente. [Oficial]
  - No MVP basta a função baseada em tabela. Claims só se uma medição mostrar necessidade. [Inferência]
- **Veredito:** implementar memberships na Fase 1. Mudar isso depois, com dados em produção, é caro.

### P4. Sincronização offline: qual abordagem? *(recomendação revisada na r2)*

| Opção | Resumo | Prós | Contras | Veredito r2 |
|---|---|---|---|---|
| **A. Outbox próprio sobre Dexie** | Fila de mutações com **só os campos alterados** e a versão base; o servidor aplica via função SQL que respeita a RLS; `version` controlado pelo servidor; pull incremental por cursor; `deleted_at` como tombstone; tabela local de conflitos | Custo zero; nenhuma peça nova que pause; reaproveita o Dexie e o código atual; controle total da regra D+C | Nós mantemos o código de sync; mídia fica numa fila à parte (como em qualquer opção) | **Padrão para o MVP** |
| **B. PowerSync + Supabase** | SQLite local sincronizado por regras; as escritas vão para o nosso backend, onde decidimos os conflitos [Oficial] | Sync incremental e parcial pronto; SDK web e **React Native** | Mais uma peça, com plano grátis que **pausa após 7 dias** e tem 50 clientes simultâneos [Oficial]; o SDK web roda só no cliente e exige `wa-sqlite`; Open Edition com licença FSL; não resolve conflitos sozinho [Oficial] | **Opção futura**, ver gatilhos |
| C. Dexie Cloud | Backend de sync da Dexie | Encaixa no Dexie | Os dados saem do nosso Postgres | Descartar |
| D. ElectricSQL | Só sincroniza leituras [Secundária] | Leve | Escrita fica por nossa conta; incerteza corporativa [Secundária, confirmar] | Descartar |
| E. Zero (Rocicorp) | Sync para web, só Postgres | 1.0 lançado [Secundária] | Só web e ainda jovem | Observar |
| F. Convex / Firebase | Online-first / NoSQL | — | Offline não é o foco; lock-in | Descartar |

**Por que mudou desde a r1:** no piloto (1 a 3 clientes, menos de 50 aparelhos, centenas de ordens), as vantagens de escala do PowerSync não aparecem. O custo dele (uma peça a mais, outra pausa no plano grátis e a troca do Dexie por SQLite) aparece desde o primeiro dia. A regra de conflitos D+C precisa ser escrita por nós em **qualquer** opção.

**Projetar para trocar depois sem retrabalho:**
- **Formato das mutações:** registrar como operações por campo (`PUT` com o registro inteiro; `PATCH` com só os campos alterados e a versão base; `DELETE`), no mesmo formato da fila de escrita do PowerSync. [Inferência — confirmar o formato na documentação de CRUD do PowerSync]
- **Aplicação no servidor:** uma única função SQL `apply_mutation`, que serve tanto para o nosso outbox quanto para um `uploadData` futuro.
- **Resultado:** se um dia trocarmos para o PowerSync, o servidor e as regras de conflito ficam iguais e só a camada local muda.

**Gatilhos para reavaliar B:**
- Decisão de fazer app nativo (G3).
- Tenants com milhares de ordens tornando o sync lento.
- Bugs de sync recorrentes e difíceis de corrigir.
- Existir receita para pagar o plano Pro deles.

**Veredito:** o "spike" da Fase 0 vira uma **fatia vertical da opção A** (2 a 3 dias). Ela inclui: outbox, `apply_mutation`, versão, cursor e tombstone, mais testes automatizados dos cenários de conflito. Critério de saída: os cenários passam e o código fica simples.

### P5. PWA ou app nativo para o técnico?
- **iOS:** [Secundária — validar em aparelho real]
  - Push só funciona com o app instalado (16.4+).
  - **Não há Background Sync**: o envio só acontece quando o app é reaberto.
  - Os dados podem ser apagados após cerca de 7 dias sem uso. As fontes divergem sobre se o app instalado escapa dessa limpeza.
  - A cota de armazenamento é menor quando o app não está instalado.
- **Android/Chrome:** instalável, com Background Sync e persistência mais previsível. [Secundária / conhecimento geral]
- **Uploads:** o Supabase Storage tem upload resumável (TUS). O URL vale 24 horas e os pedaços têm 6 MB fixos. [Oficial]
- **Participação de Android no Brasil:** não verifiquei. [Confirmar]
- **Veredito:**
  - **PWA primeiro**, tratando o armazenamento local como cache e a nuvem como verdade.
  - **Portão G3:** se o piloto mostrar perda de fotos ou dados no iOS, ou muitos técnicos com iPhone, embrulhar o app com **Capacitor** (reaproveita o código web). Expo/React Native seria um app novo e é mais caro.
  - Nativo exige conta Apple (~US$ 99/ano) e Google (taxa única), o que **conflita com o custo zero**. Só depois de haver receita. [Inferência — confirmar valores]

### P6. Next.js e hospedagem *(revisado na r2)*
- **Vercel Hobby proíbe uso comercial.** Ao cobrar, seria preciso o Pro. [Oficial]
- **O app não usa nada de servidor do Next** [Código], então dá para gerar um **site estático** (`output: 'export'`) e publicá-lo de graça.
- **O que a exportação estática não suporta** [Oficial — docs do Next em `node_modules`]: `headers()` do `next.config`, rewrites, redirects, Route Handlers dinâmicos, cookies, proxy e otimização de imagem padrão.
- **Impactos no nosso código:**
  - Os headers do `/sw.js` passam a ser configurados na hospedagem (por exemplo, um arquivo `_headers`).
  - `src/app/work-orders/page.tsx` usa `redirect()` e precisa ser revisto.
  - Manifest e páginas já são estáticos. [Código — o build mostra tudo como ○ Static]
- **Necessidades de servidor** (chamado público por QR, webhooks, PDF): Supabase Edge Functions, no plano gratuito.
- **Bônus de segurança:** sem servidor Next em produção, as vulnerabilidades críticas atuais deixam de ter superfície de ataque. O upgrade continua recomendado.
- **Veredito:** **manter o Next como gerador de site estático** e publicar numa hospedagem gratuita que permita uso comercial. A escolha final da hospedagem é a decisão G5, depois de confirmar os termos. Trocar por Vite não traz ganho que pague a reescrita.

### P7. Arquitetura do código
- **Alvo:**
  - Módulos por funcionalidade: `features/work-orders`, `features/properties`, `features/sync`.
  - Regras de domínio em funções puras e testáveis.
  - Validação com Zod nas bordas.
  - Tipos gerados com `supabase gen types`.
  - Leitura reativa do Dexie com `liveQuery`, no lugar do estado duplicado nos componentes.
- **Veredito:** refatorar **junto** com as Fases 1 e 2, nunca como tarefa isolada.

### P8. Qualidade, segurança e operação (todos com plano gratuito)
- **Testes e monitoramento:**
  - CI rodando `tsc`, lint, build e testes.
  - Vitest para domínio e sync.
  - **Testes de RLS**: um usuário de outro tenant não lê nem escreve.
  - Playwright com um smoke test offline.
  - Sentry no plano grátis.
- **Backup próprio:** semanal e cifrado. O Storage não entra no backup do banco; [Oficial] por isso, exportar também os metadados e as fotos críticas.
- **LGPD:** há fotos de residências e dados pessoais. Precisamos de base legal, política de retenção e de exclusão. [Inferência — validar com jurídico]

### P9. Pagamentos e take-rate
- **Como funciona:**
  - Asaas usa subcontas e um `walletId` por recebedor.
  - Pagar.me, Stripe e Juno têm split nativo.
  - Pix com split precisa ser feito no momento da venda, segundo a documentação da Cielo. [Secundária]
  - As tarifas são por transação. [Secundária — confirmar]
- **Veredito:** fora do MVP. Na Fase 4, cobrança manual depois do orçamento aprovado. Na Fase 5, split.

---

## 6. Arquitetura alvo (r2)

```
 Solicitante (link/QR, sem login) ──► Supabase Edge Function (Turnstile + rate limit) ──┐
                                                                                          │
 Técnico (PWA Android/iOS) ─┐                                                            ▼
 Gestor (web)              ─┼─► Front estático (Next export) em hospedagem grátis
                            │      │
                            │      ├─ Dexie (cache local) + OUTBOX de mutações por campo
                            │      │        │ apply_mutation (RPC, respeita RLS) / pull por cursor
                            │      │        ▼
                            │      └──► Supabase (grátis): Auth (SMTP próprio) · Postgres (RLS + memberships)
                            │                                · Storage (fotos via TUS, fila própria)
                            └── Service worker (abre offline)
 Backup: CI semanal → `supabase db dump` cifrado.   Futuro (gatilhos): PowerSync · Capacitor · pagamentos.
```

## 7. Modelo de dados alvo (esboço)

- **Acesso:** `tenants` (o cliente pagante) e `memberships (user_id, tenant_id, role)`.
- **Locais:** `properties`, com `units`/locais; `assets` (equipamentos) entra a partir da Fase 2.
- **Ordens:** `work_orders` ganha `assignee_id`, `due_at`, `category`, `origin` (corretiva ou preventiva), `requester`, `deleted_at` e `version`.
- **Histórico e anexos:** `work_order_events` (só inserção: linha do tempo e auditoria) e `attachments` (caminho no Storage).
- **Negócio (Fases 4 e 5):** `vendors` → `quotes` → `approvals`, e depois `payments`.
- **Regras gerais:**
  - Excluir é marcar `deleted_at`, nunca DELETE físico.
  - `version` e `updated_at` são controlados pelo servidor.
  - A RLS se baseia em `memberships`.
  - Os arquivos no Storage seguem o caminho `tenant_id/...`, com policy equivalente.

## 8. Roadmap por fases

As estimativas são ordem de grandeza para um desenvolvedor com assistência de IA. Recalibrar depois da Fase 0. **Todas as fases custam R$ 0.**

**Fase 0 — Fundação e decisões (~1 a 1,5 semana)**
1. Upgrade do Next e do `eslint-config-next`; revalidar build, lint e o teste offline.
2. Supabase CLI: migrations versionadas (converter 001 a 004), `supabase start` local e tipos gerados. Remover o `docker-compose` falso.
3. CI com Vitest, testes de RLS e o smoke offline no Playwright.
4. Configurar SMTP próprio (cota grátis) e o backup semanal.
5. **Prova da exportação estática:** `output: 'export'`, headers do service worker pela hospedagem, revisão do `redirect`, publicação de teste numa hospedagem grátis (G5).
6. **Fatia vertical do outbox (opção A)**, com os testes dos cenários de conflito (G1).
7. **Descoberta com clientes, em paralelo:** 5 a 10 conversas com síndicos, administradoras e zeladores (G2).
- **Saída:** CI verde, ambiente local reproduzível, deploy estático funcionando e decisões G1, G2 e G5 tomadas.

**Fase 1 — Núcleo de dados (~2 semanas)**
- Memberships e seleção de tenant; `deleted_at`; `version`; `work_order_events`; responsável e prazo.
- Quebrar o `WorkOrderManager` em módulos; Zod; `liveQuery`.
- **Preenchimento automático da OS** (feedback do fundador em 2026-11-13: o atual é "pobre"). Ideias, todas com custo zero, em ordem de retorno estimado:
  1. Chamado por QR/link do local: imóvel, unidade e solicitante já preenchidos; a pessoa só descreve e fotografa.
  2. Categoria e prioridade sugeridas (palavras-chave na descrição), com confirmação.
  3. Responsável e prazo padrão por categoria ou imóvel.
  4. Modelos de OS para serviços repetidos.
  5. OS preventivas recorrentes geradas automaticamente.
  6. Histórico do local ao escolher o imóvel (evita duplicidade).
  7. Ditado por voz na descrição.
  - **Em aberto:** o que mais incomoda (excesso de campos ou digitar tudo) e quem preenche na prática. Isso entra na descoberta com clientes (G2).
- **Saída:** a funcionalidade atual, agora multi-cliente e testada.

**Fase 2 — Sync definitivo, conflitos e mídia (~2 a 3 semanas)**
- Outbox completo com a regra D+C:
  - Campos diferentes são mesclados automaticamente.
  - No mesmo campo, o usuário escolhe.
  - **Ordem apagada no servidor: avisar e o técnico escolhe** (já decidido).
- Fotos: compressão, fila resumável TUS, miniaturas e limite de armazenamento local.
- **Saída:** os cenários de conflito e de fotos passam em teste automatizado e em dois aparelhos reais.

**Fase 3 — MVP de piloto gratuito (~2 a 3 semanas)**
- Chamado por link/QR (Edge Function com Turnstile).
- Triagem, atribuição, execução e aprovação.
- Relatório por imóvel.
- E-mail via SMTP próprio; push no Android.
- Onboarding self-service.
- LGPD básica.
- **Saída:** 1 a 3 clientes em piloto. Medir chamados por semana, tempo até a conclusão, falhas de sync e uso offline.

**Fase 4 — Orçamentos e prestadores (~3 semanas).** **Fase 5 — Pagamentos e split.** **Portão G3** (Capacitor) e **upgrade de planos** apenas com receita.

## 9. Gatilhos de custo (quando passar a pagar)

| Gatilho | Ação | Custo aproximado |
|---|---|---|
| Primeiro cliente **pagante** | Supabase Pro (backups diários, sem pausa) | ~US$ 25/mês [Secundária] |
| Banco ou storage acima de ~70% do limite grátis | Supabase Pro ou limpeza e compressão | idem |
| Precisar de servidor Next (SSR/rotas) | Vercel Pro ou equivalente | ~US$ 20/mês [confirmar] |
| App nativo aprovado (G3) | Contas Apple e Google | ~US$ 99/ano + taxa única [confirmar] |
| Gatilhos de sync da P4 | PowerSync Pro | ~US$ 49/mês [Secundária] |
| Volume de e-mail acima da cota grátis | Plano pago do provedor de SMTP | variável |

## 10. Decisões

| # | Decisão | Quando | Recomendação |
|---|---|---|---|
| G0 | Aprovar o plano e a pausa em novos recursos | Agora | Sim |
| G1 | Sync: outbox próprio (A) × PowerSync (B) | Fim da Fase 0 | **A**, no formato compatível com B |
| G2 | Persona e gancho do MVP | Fim da descoberta | Síndico/administradora pequena + zelador; chamado por QR |
| G3 | PWA × Capacitor/nativo | Depois do piloto, e só com receita | PWA até haver evidência |
| G4 | Modelo de cobrança (assinatura × take-rate) | Antes da Fase 4 | Piloto grátis; decidir com dados |
| G5 | Hospedagem estática gratuita com uso comercial permitido | Fase 0 | Exportação estática; confirmar os termos do Cloudflare Pages (ou alternativa) |

## 11. Riscos principais
1. **Construir demais antes de validar.** Mitigação: descoberta na Fase 0 e piloto na Fase 3.
2. **Pausas e limites dos planos gratuitos.** Mitigação: uso diário no piloto, monitoramento de limites, backup próprio e gatilhos da seção 9.
3. **iOS reduz a confiabilidade do offline.** Mitigação: portão G3 e testes em aparelho real.
4. **Sync próprio com bugs.** Mitigação: formato compatível com PowerSync, testes de cenário e gatilhos para migrar.
5. **Marketplace sem liquidez, com carga fiscal e KYC.** Mitigação: só nas Fases 4 e 5, com contador.
6. **Vazamento de dados entre clientes.** Mitigação: testes de RLS no CI desde a Fase 0.

## 12. Lacunas (verificar antes de decidir)
- **Preços e cotas:** Supabase, PowerSync, Sentry, Edge Functions, GitHub Actions e SMTP. Conferir nas páginas oficiais.
- **Hospedagem:** termos de uso comercial do plano gratuito do Cloudflare Pages ou da alternativa escolhida.
- **iOS:** se o app instalado escapa da limpeza de dados e se há Background Sync. **Testar em aparelho real.**
- **Mercado brasileiro** e participação Android/iOS entre técnicos.
- **Formato da fila de escrita do PowerSync** (para manter a compatibilidade da opção A).

## Fontes
- **Sync (secundárias):**
  - [Offline-First Data & Sync](https://progressivewebapps.com/architecture/offline-first/)
  - [ElectricSQL vs PowerSync vs Replicache](https://queryplane.com/blog/electricsql-vs-powersync-vs-replicache/)
  - [ElectricSQL vs PowerSync vs Zero (2026)](https://trybuildpilot.com/648-electric-sql-vs-powersync-vs-zero-2026)
  - [Offline-First Mobile Architecture 2026](https://frenchydigital.com/blog/offline-first-mobile-architecture-2026)
  - [Zero 1.0 — InfoQ](https://infoq.com/news/2026/06/zero-version-1)
- **PowerSync (oficial):**
  - [Conflitos customizados](https://docs.powersync.com/handling-writes/custom-conflict-resolution)
  - [Supabase + PowerSync](https://docs.powersync.com/integration-guides/supabase-+-powersync)
  - [Next.js](https://docs.powersync.com/client-sdks/frameworks/next-js)
  - [Preços](https://powersync.com/pricing)
  - [Uso e cobrança](https://docs.powersync.com/resources/usage-and-billing)
  - [FAQ de cobrança](https://docs.powersync.com/resources/usage-and-billing/usage-and-billing-faq)
  - [Licenciamento](https://powersync.com/legal/licensing-terms)
- **Dexie Cloud:**
  - [Consistência](https://dexie.org/cloud/docs/consistency)
  - [Produto](https://dexie.org/product)
- **PWA e iOS (secundárias):**
  - [PWA iOS Limitations](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)
  - [iOS PWA Compatibility](https://firt.dev/notes/pwa-ios/)
  - [Fórum Apple — Background Sync](https://developer.apple.com/forums/thread/694805)
- **Nativo × PWA:**
  - [PWA vs Native vs React Native (2026)](https://www.buildmvpfast.com/blog/pwa-vs-native-vs-react-native-solo-founder-decision-2026)
  - [React Native vs Expo vs Capacitor](https://www.pkgpulse.com/guides/react-native-vs-expo-vs-capacitor-cross-platform-mobile-2026)
- **Supabase (oficial):**
  - [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
  - [Desempenho de RLS](https://supabase.com/docs/guides/database/postgres/row-level-security-performance)
  - [Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook)
  - [Custom Claims & RBAC](https://supabase.com/docs/guides/api/custom-claims-and-role-based-access-control-rbac)
  - [Migrations](https://supabase.com/docs/guides/deployment/database-migrations)
  - [Fluxo local](https://supabase.com/docs/guides/local-development/cli-workflows)
  - [Uploads resumáveis](https://supabase.com/docs/guides/storage/uploads/resumable-uploads)
  - [Pausa de projetos grátis](https://supabase.com/docs/guides/platform/free-plan-pausing)
  - [Backups](https://supabase.com/docs/guides/platform/backups)
  - [Backups no plano grátis](https://supabase.com/kb/faqs/platform/free-plan-backups)
  - [Checklist de produção (SMTP)](https://supabase.com/docs/guides/deployment/going-into-prod)
- **Supabase (secundárias):**
  - [Alternativas 2026](https://dev.to/max4nhost/supabase-alternatives-in-2026-6of)
  - [Preços 2026](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/)
  - [RLS multi-tenant](https://dev.to/kanta13jp1/supabase-rls-deep-dive-multi-tenant-design-dynamic-policies-and-performance-4adk)
  - [Limite de e-mail do Supabase](https://flaviocopes.com/supabase-email-rate-limit/)
- **Vercel (oficial):**
  - [Plano Hobby](https://vercel.com/docs/plans/hobby)
  - [Fair use](https://vercel.com/docs/limits/fair-use-guidelines)
  - Fórum (secundária): [protótipo de SaaS no Hobby](https://community.vercel.com/t/is-hobby-plan-suitable-for-a-saas-prototype/7205)
- **Next (oficial):** exportação estática em `node_modules/next/dist/docs/01-app/02-guides/static-exports.md`
- **Mercado e pagamentos:**
  - [Sindiconet](https://www.sindiconet.com.br/informese/manutencao-do-condominio-na-palma-da-mao-mercado-coluna-de-olho-no-mercado)
  - [Unitify](https://unitify.com/brazil)
  - [Asaas — split](https://blog.asaas.com/split-de-pagamento/)
  - [Asaas — FAQ do split](https://docs.asaas.com/docs/faq-do-split)
  - [Cielo — Pix em split](https://docs.cielo.com.br/split/v1.0-en/docs/pix-1)
- **CMMS:**
  - [Reliable — melhores CMMS 2026](https://reliamag.com/guides/best-cmms-software-2026/)
  - [MaintainX vs Limble](https://reliamag.com/topics/cmms/maintainx-vs-limble)
