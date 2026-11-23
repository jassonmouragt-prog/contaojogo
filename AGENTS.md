<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Conta o Jogo — regras do agente
- Requisitos: `docs/SPEC.md`. Progresso: `docs/PROGRESS.md`. PDF original só para detalhe visual.
- Cache Components ativo: dados por request exigem `connection()`/Suspense. Middleware = `src/proxy.ts`.
- Código por domínio: `src/domain/*` (lógica pura, testada), `src/db/schema/*`, `src/components/brand/*` (design system).
- Autorização sempre no servidor; toda escrita importante gera `audit_log`.
- Realtime só depois do commit no banco. Eventos com chave de idempotência.
- Sem dados fictícios em produção; `/design` só em dev.
- Verificar com `npm run check` e `npm run build`; E2E com `npm run test:e2e`.
- Uma fase por vez; não avançar com falhas críticas. Sem deploy/mudança destrutiva sem autorização.
