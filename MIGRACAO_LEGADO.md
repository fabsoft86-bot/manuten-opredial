# Migração não destrutiva de tickets

O script `scripts/migrate-legacy-tickets.js` copia registros para `public.work_orders`; não apaga nem atualiza a origem.

## Fontes aceitas

Por padrão, o script lê `mock-data.json`. Para outro arquivo JSON, passe um array de tickets ou um objeto com `tickets`, `occurrences` ou `data`:

```powershell
node scripts/migrate-legacy-tickets.js
node scripts/migrate-legacy-tickets.js --source .\exports\tickets.json
```

Para ler a tabela `public.tickets` de um Supabase legado, defina `LEGACY_SUPABASE_URL` e `LEGACY_SUPABASE_SERVICE_ROLE_KEY` no terminal e execute:

```powershell
node scripts/migrate-legacy-tickets.js --source-table
```

Se origem e destino estiverem no mesmo projeto, `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` servem para ambos.

## Prévia e aplicação

Sem `--apply`, o script só mostra contagens, conversões e exemplos; nenhuma gravação é feita. Revise essa prévia antes de qualquer aplicação.

O destino é o tenant `a0000000-0000-0000-0000-000000000001`. Para aplicar, defina a URL de destino e informe a service-role key sem gravá-la no código, no `.env.example` ou em variável `NEXT_PUBLIC_*`:

```powershell
$env:SUPABASE_URL = 'https://<project-ref>.supabase.co'
$secret = Read-Host 'Chave service_role do projeto de destino' -AsSecureString
$env:SUPABASE_SERVICE_ROLE_KEY = [System.Net.NetworkCredential]::new('', $secret).Password
node scripts/migrate-legacy-tickets.js --apply
Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY
Remove-Variable secret
```

## Conversão e garantias

- `title` vira `title`; se não existir, usa `titulo`, propriedade/local ou location.
- `description`/`descricao` vira `description`.
- Aberto/desconhecido vira `open`; pendente vira `pending_review`; concluído/fechado/resolvido vira `completed`; andamento vira `in_progress`; cancelado vira `cancelled`.
- Prioridade vermelha/urgente vira `urgent`, amarela/alta vira `high`, verde/normal vira `normal` e baixa vira `low`.
- Todos os registros recebem o tenant informado; `property_id` fica `null` porque o script não cria propriedades nem adivinha relações.
- UUIDs antigos são preservados. IDs legados não UUID recebem UUID determinístico. Registros sem ID são ignorados para evitar duplicatas em reexecuções.
- IDs já existentes em `work_orders` são ignorados, sem sobrescrita; reexecutar é idempotente.
- O schema FixPro não possui campos para categoria, responsável, prazo, anexos ou `details`. O script avisa quando encontra esses metadados e não os migra. Eles permanecem na origem; decida antes se devem ganhar estrutura própria no destino.

A service-role key contorna RLS. Use-a apenas localmente, no projeto de destino correto, e remova-a do ambiente do terminal após a execução. Nunca a compartilhe ou inclua em commits.
