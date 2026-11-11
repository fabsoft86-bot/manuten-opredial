# HANDOFF — FixPro (Manutenção Predial)

Leia este arquivo primeiro numa nova sessão. Leia também o `AGENTS.md`: o Next usado aqui (16.x) tem mudanças; consulte `node_modules/next/dist/docs/` antes de escrever código específico do Next.

## O que é
PWA offline-first em Next 16 + React 19 + Dexie (IndexedDB) + Supabase (Postgres, Auth, RLS). Multi-tenant por `tenant_id`. Papéis: `admin`, `manager`, `technician`, `viewer`. Tela principal: `src/components/work-orders/WorkOrderManager.tsx`.

## Localização
- Pasta atual: `C:\Users\Desktop\Desktop\PROJETOS TI\fixpro-manutencao-predial`
- A pasta antiga `PROJETOS TI\MANUTENÇÃO_PREDIAL` é cópia obsoleta e deve ser apagada (o usuário fará isso após fechar o VS Code).

## Já feito
- `pruneSyncedRecords` (`src/lib/db/indexedDB.ts`): remove do cache local ordens/imóveis sincronizados que sumiram do servidor.
- Sync resiliente (`src/services/syncService.ts`): falha de um item não trava os outros; erros agregados; pull sempre roda; nova chamada durante sync em andamento faz novo sync (`synchronizeTenant` no WorkOrderManager).
- Export `indexedDB` renomeado para `db`.
- Migration `docker/postgres/init/004_hardening.sql` (search_path de `set_updated_at` + trigger que impede `property_id` de outro tenant). **Ainda NÃO aplicada no Supabase** — o usuário precisa rodar no SQL Editor (depois da 003).
- Limpeza: arquivos vazios da raiz, clone vazio `imovel` e pasta `.cursor` removidos; pacote renomeado; `.cursorrules` atualizado.

## PWA — concluído (testado em Chrome via CDP, build de produção)
- `src/app/manifest.ts`, ícones em `public/icons/` (gerados de `icon.svg`), metadata/viewport no layout; `favicon.ico` movido para `src/app/`.
- `public/sw.js`: cache-first para `/_next/static`, network-first com timeout para HTML, stale-while-revalidate para ícones/manifest. Supabase, RSC e API nunca são cacheados. Incrementar `VERSION` ao alterar. Registrado só em produção (`ServiceWorkerRegister`): testar com `npm run build && npm start`, não com `next dev`. Headers de `/sw.js` em `next.config.ts`.
- `InstallPrompt`: botão Instalar no Chrome/Android; instrução de "Adicionar à Tela de Início" no iOS.
- **Identidade offline** (`src/lib/offlineIdentity.ts`): `AuthGuard` e `TenantContext` usam a última identidade (usuário, papel, tenant), salva em localStorage, quando não há rede. Ela é limpa no logout/SIGNED_OUT. Ao voltar a rede, papel/tenant são revalidados. Logout offline usa `signOut({ scope: 'local' })`.
- Teste feito: offline sem identidade → /login; offline com identidade → tela de ordens com tenant e papel.
- **Não testado**: login real no Supabase offline→online (precisa de usuário real) e instalação em celular.
- Limitação conhecida: a sessão do Supabase expira em ~1h. Offline o app segue com a identidade salva, mas o envio ao servidor só funciona depois que a sessão for renovada com rede.

## Decisões de negócio (confirmadas pelo usuário) — conflitos de sincronização
Conflito em ordens de serviço = **mesclagem por campo (D) + pergunta ao usuário (C)**:
1. Guardar no aparelho a versão base de cada ordem (nova versão do Dexie, ex.: `base_updated_at` / snapshot dos campos).
2. Ao enviar, só atualizar se o servidor ainda está na versão base (update condicional); senão há conflito.
3. Campos diferentes alterados dos dois lados → mescla automática. Mesmo campo alterado dos dois lados → tela para o usuário escolher "manter a minha" ou "manter a do servidor". Sugestão de padrão: o status vindo do técnico tende a ser o mais confiável.
4. Ordem **apagada no servidor** enquanto editada offline → **avisar o técnico e deixar ele escolher** entre recriar com a edição local ou descartar.

## Falta
1. **Conflitos D+C** (decisões acima) — ainda não implementado. É o próximo passo.
2. O usuário precisa rodar a migration 004 no Supabase e dar push no GitHub Desktop.
3. Aviso do `next build`: o Next 16.4.0 está marcado com vulnerabilidade conhecida (advisory do npm). Decidir se faz o upgrade de `next` e `eslint-config-next` e revalidar build/lint. Obs.: o build para na primeira tentativa por causa desse aviso; repetir o comando continua normalmente.

## Notas
- `.env.local` tem as chaves do Supabase e um `VERCEL_OIDC_TOKEN`; está no `.gitignore`. Nunca colocar `service_role` em `NEXT_PUBLIC_*`.
- Verificações: `npx tsc --noEmit` e `npm run lint` (passam).
- Regra do projeto (`.cursorrules`): não alterar layout/lógica de negócio existentes sem validação; planejar antes de grandes refatorações.
