# Publicação (Vercel) e operação

## 1. Repositório
1. Crie um repositório **privado** no GitHub na conta do proprietário (ex.: `contaojogo`).
2. Na pasta do projeto: `git init && git add . && git commit -m "Conta o Jogo" && git branch -M main && git remote add origin <url> && git push -u origin main`
   (`.env.local` está no .gitignore — nunca suba segredos).

## 2. Vercel
1. vercel.com → Add New Project → importe o repositório (framework Next.js detectado).
2. Variáveis de ambiente (Production):
   | Nome | Valor |
   |---|---|
   | `DATABASE_URL` | string do branch **main** do Neon (projeto `contaojogo`, região São Paulo) |
   | `BETTER_AUTH_SECRET` | `openssl rand -base64 32` (novo, só para produção) |
   | `BETTER_AUTH_URL` | `https://contaojogo.club` |
   | `APP_TIMEZONE` | `America/Sao_Paulo` |
   | `ABLY_API_KEY` | opcional (tempo real instantâneo) |
3. Preview deployments: use o branch `dev` do Neon em `DATABASE_URL` (Preview) e `BETTER_AUTH_URL` do preview.
4. Região das funções: `gru1` (São Paulo), perto do banco.
5. Domínio: Settings → Domains → `contaojogo.club` e `www` (DNS no registrador, conta do proprietário).

## 3. Banco
- Migrações: `DATABASE_URL=<prod> npx drizzle-kit migrate` antes de cada deploy que traga arquivo novo em `drizzle/`.
- Proprietário: `npm run owner:create -- --email … --name …` (já feito para jassonmouragt@gmail.com).
- Senha esquecida: Admin → Usuários → Redefinir senha, ou `npm run user:set-password`.

## 4. Backups e restauração
- **Neon (PITR):** restauração para qualquer momento dentro da janela de histórico do plano (Console → Branches → Restore). Snapshot manual `pre-lancamento-2026-11-23` criado.
- **Diário:** `.github/workflows/backup.yml` faz `pg_dump` às 04:00 e guarda 30 dias. Cadastre o segredo `DATABASE_URL_PRODUCTION` no GitHub (Settings → Secrets → Actions). Rode uma vez manualmente (Actions → Backup → Run).
- **Restaurar um dump:** crie um branch novo no Neon e rode `pg_restore --no-owner -d "<url do branch>" contaojogo-AAAA-MM-DD.dump`; confira e então promova/aponte a aplicação.
- **Exportação JSON:** Admin → Configurações → Baixar exportação (proprietário).

## 5. Checklist de lançamento
- [ ] Trocar a senha do proprietário e ativar a verificação em duas etapas (Admin → Minha conta).
- [ ] `BETTER_AUTH_SECRET` de produção diferente do de desenvolvimento.
- [ ] Domínio, hospedagem, banco, GitHub e Vercel em contas/e-mail do proprietário.
- [ ] Primeiro backup manual executado com sucesso.
