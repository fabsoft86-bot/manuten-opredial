# Setup do Supabase

## Configurar as variáveis locais

1. No painel do Supabase, abra o projeto e copie o **Project URL** e a chave pública **anon** (ou a chave publicável, caso seu projeto use o formato novo).
2. Copie `.env.example` para `.env.local` na raiz do projeto e preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` com esses valores.
3. Reinicie o servidor de desenvolvimento depois de alterar as variáveis:

   ```powershell
   Copy-Item .env.example .env.local
   npm run dev
   ```

As chaves `NEXT_PUBLIC_*` são disponibilizadas no navegador. Use somente a chave pública anon/publicável; nunca coloque `service_role` ou outra chave secreta nessas variáveis.

## Executar as migrations

No painel do Supabase, abra **SQL Editor**. Em um projeto novo, abra, copie e execute o conteúdo dos arquivos abaixo, nesta ordem:

1. `docker/postgres/init/001-uuid-ossp.sql` — habilita a extensão usada para gerar UUIDs.
2. `docker/postgres/init/002_schema.sql` — cria tenants, perfis, imóveis e ordens de serviço, além das políticas RLS, índices e trigger.

Execute cada arquivo uma única vez e aguarde a conclusão antes de executar o próximo. Essas instruções são para um projeto Supabase novo; não reaplique a migration de schema em um banco já provisionado sem revisar os objetos existentes.

## Criar usuário e tenant de homologação

1. No Supabase, abra **Authentication > Users** e crie um usuário de teste. Informe e confirme o e-mail e defina uma senha para homologação. Se a confirmação de e-mail estiver habilitada, confirme o endereço antes de tentar entrar.
2. No **SQL Editor**, execute o bloco abaixo substituindo `admin@fixpro.local` pelo mesmo e-mail cadastrado. Ele cria um tenant e associa o usuário a um perfil `admin`. Execute uma vez para esse usuário.

   ```sql
   DO $$
   DECLARE
     test_email text := 'admin@fixpro.local';
     test_user_id uuid;
     test_tenant_id uuid;
   BEGIN
     SELECT id
       INTO test_user_id
       FROM auth.users
       WHERE email = test_email;

     IF test_user_id IS NULL THEN
       RAISE EXCEPTION 'Usuário % não encontrado. Crie-o primeiro em Authentication > Users.', test_email;
     END IF;

     IF EXISTS (SELECT 1 FROM public.profiles WHERE id = test_user_id) THEN
       RAISE EXCEPTION 'O usuário % já possui um perfil/tenant associado.', test_email;
     END IF;

     INSERT INTO public.tenants (name)
       VALUES ('FixPro Homologação')
       RETURNING id INTO test_tenant_id;

     INSERT INTO public.profiles (id, tenant_id, role, full_name)
       VALUES (test_user_id, test_tenant_id, 'admin', 'Administrador de Homologação');
   END $$;
   ```

3. Acesse `/login` na aplicação e entre com o e-mail e a senha criados no Auth. O tenant será carregado a partir do perfil associado ao usuário.

Se o login ocorrer, mas nenhum tenant aparecer, confira se o registro em `public.profiles` referencia o UUID do usuário em `auth.users` e se as migrations foram executadas na ordem indicada.