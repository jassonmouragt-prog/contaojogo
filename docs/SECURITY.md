# Segurança — resumo

- **Autenticação:** Better Auth (scrypt), sessão 7 dias, rate limit de login, 2FA TOTP opcional, bloqueio encerra sessões.
- **Autorização:** sempre no servidor (`authorizeAction`/`requirePermission`), perfil lido do banco a cada requisição; hierarquia OWNER > ADMIN > OPERATOR > USER; último proprietário protegido. Varredura automática: toda server action exportada checa sessão.
- **Dados:** consultas sempre com `organization_id` do usuário; CHECKs e índices únicos no banco; transações com `FOR UPDATE`/advisory lock onde há concorrência; idempotência por id do cliente.
- **Auditoria:** `audit_log` com usuário, IP, antes/depois em toda alteração relevante (Admin → Auditoria).
- **Entrada:** Zod em todas as ações; URLs externas só `https`; notícias em texto puro (sem HTML); honeypot e limite de taxa no suporte; limites em métricas e polling.
- **Cabeçalhos:** CSP (scripts só do próprio domínio, frame-ancestors none), HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, sem X-Powered-By.
- **Privacidade:** data de nascimento nunca vai ao portal; exportação exclui senhas/sessões/tokens.
- **Dependências:** `npm audit --omit=dev` → 4 avisos moderados de `esbuild` (servidor de desenvolvimento do drizzle-kit), sem impacto em produção.
- **Limites conhecidos:** rate limit em memória por instância (para limite global, Upstash/Redis).
