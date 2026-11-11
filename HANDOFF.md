# HANDOFF — FixPro (Manutenção Predial)

Leia este arquivo primeiro numa nova sessão. Leia também o `AGENTS.md`: o Next usado aqui (16.x) tem mudanças; consulte `node_modules/next/dist/docs/` antes de escrever código específico do Next.

## O que é
PWA offline-first em Next 16 + React 19 + Dexie (IndexedDB) + Supabase (Postgres, Auth, RLS). Multi-tenant por `tenant_id`. Papéis: `admin`, `manager`, `technician`, `viewer`. Tela principal: `src/components/work-orders/WorkOrderManager.tsx`.

## Localização
- Pasta atual: `C:\Users\Desktop\Desktop\PROJETOS TI\fixpro-manutencao-predial`
- A pasta antiga `PROJETOS TI\MANUTENÇÃO_PREDIAL` é cópia obsoleta e deve ser apagada (o usuário fará isso após fechar o VS Code).

## Já feito (commits eabff72 e 331dfb1, locais; o usuário dá push pelo GitHub Desktop)
- `pruneSyncedRecords` (`src/lib/db/indexedDB.ts`): remove do cache local ordens/imóveis sincronizados que sumiram do servidor.
- Sync resiliente (`src/services/syncService.ts`): falha de um item não trava os outros; erros agregados; pull sempre roda; nova chamada durante sync em andamento faz novo sync (`synchronizeTenant` no WorkOrderManager).
- Export `indexedDB` renomeado para `db`.
- Migration `docker/postgres/init/004_hardening.sql` (search_path de `set_updated_at` + trigger que impede `property_id` de outro tenant). **Ainda NÃO aplicada no Supabase** — o usuário precisa rodar no SQL Editor (depois da 003).
- Limpeza: arquivos vazios da raiz, clone vazio `imovel` e pasta `.cursor` removidos; pacote renomeado; `.cursorrules` atualizado.

## Decisões de negócio (confirmadas pelo usuário)
Conflito de sincronização de ordens de serviço = **mesclagem por campo (D) + pergunta ao usuário (C)**:
1. Guardar no aparelho a versão base de cada ordem (nova versão do Dexie, ex.: `base_updated_at` / snapshot dos campos).
2. Ao enviar, só atualizar se o servidor ainda está na versão base (update condicional); senão há conflito.
3. Campos diferentes alterados dos dois lados → mescla automática. Mesmo campo alterado dos dois lados → tela para o usuário escolher "manter a minha" ou "manter a do servidor". Sugestão de padrão: o status vindo do técnico tende a ser o mais confiável.
4. Ordem **apagada no servidor** enquanto editada offline → **avisar o técnico e deixar ele escolher** entre recriar com a edição local ou descartar.

## PWA — concluído (testado em Chrome via CDP, build de produção)
- , ícones em  (gerados de ), metadata/viewport no layout,  movido para .
-  (cache-first para , network-first com timeout para HTML, SWR para ícones/manifest; Supabase/RSC/API nunca são cacheados). Incrementar  ao alterar. Registrado só em produção (); testar com > fixpro-manutencao-predial@1.0.0 build
> next build

▲ Next.js 16.4.0 (Turbopack)
- Environments: .env.local
✓ Running next.config.ts took 65ms

  Creating an optimized production build ...
✓ Compiled successfully in 502ms
  Running TypeScript ...
  Finished TypeScript in 3.1s ...
  Collecting page data using 7 workers ...
  Generating static pages using 7 workers (0/7) ...
  Generating static pages using 7 workers (1/7) 
  Generating static pages using 7 workers (3/7) 
  Generating static pages using 7 workers (5/7) 
✓ Generating static pages using 7 workers (7/7) in 603ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /login
├ ○ /manifest.webmanifest
└ ○ /work-orders


○  (Static)  prerendered as static content, não com . Headers de  em .
-  (botão Instalar no Chrome/Android; instrução no iOS).
- **Identidade offline** (): o  e o  usam a última identidade (usuário, papel, tenant) salva em localStorage quando não há rede; ela é limpa no logout/SIGNED_OUT. Ao voltar a rede, o papel/tenant é revalidado. Logout offline usa .
- Teste feito: offline sem identidade → /login; offline com identidade → tela de ordens com tenant e papel. **Não testado**: login real com Supabase offline→online (precisa de usuário real), nem instalação em celular.
- Limitação conhecida: a sessão do Supabase expira em ~1h; offline o app segue usando a identidade salva, mas o envio ao servidor só funciona depois que a sessão for renovada com rede.

## Falta
1. **Conflitos D+C** (decisões acima) — ainda não implementado. É o próximo passo.
2. Usuário precisa: rodar a 004 no Supabase; dar push no GitHub Desktop (adicionar a pasta nova em File > Add local repository).
3. Aviso do : o Next 16.4.0 está marcado com vulnerabilidade conhecida (advisory do npm). Decidir se faz o upgrade (; atualizar  e ) e revalidar build/lint.

## Notas
- `.env.local` tem as chaves do Supabase e um `VERCEL_OIDC_TOKEN`; está no `.gitignore`. Nunca colocar `service_role` em `NEXT_PUBLIC_*`.
- Verificações: `npx tsc --noEmit` e `npm run lint` (passavam no último commit).
- Regra do projeto (`.cursorrules`): não alterar layout/lógica de negócio existentes sem validação; planejar antes de grandes refatorações.
