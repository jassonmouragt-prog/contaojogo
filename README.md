# Conta o Jogo

Plataforma de campeonatos e partidas ao vivo — contaojogo.club.

```bash
npm install
cp .env.example .env.local   # preencha DATABASE_URL e BETTER_AUTH_SECRET
npm run db:migrate
npm run dev                  # http://localhost:3000  (catálogo visual: /design)
npm run check                # typecheck + lint + testes unitários
npm run build && npm run test:e2e
```

Especificação: `docs/SPEC.md` • Progresso: `docs/PROGRESS.md` • Publicação: `docs/DEPLOY.md` • Segurança: `docs/SECURITY.md`.
