# Progresso

## Fase 1 — Fundação ✅ (2026-11-23)
- Next 16 + TS strict + Tailwind 4 + shadcn/ui; tema escuro fiel ao PDF; fontes Barlow/Barlow Condensed/JetBrains Mono.
- Design system: Logo, StatusPill, Scoreboard, ClockCard, StatCompare, MatchCard, SectionHeading, header/footer. Catálogo em `/design` (dev).
- Banco: Drizzle + Neon (WebSocket), schema organizations/auth (Better Auth)/audit_log, migration `drizzle/0000_init.sql`.
- Domínio: cronômetro por timestamps (`src/domain/match/clock.ts`).
- Env validado com Zod; `/api/health`.
- Testes: 14 unit (Vitest), 6 E2E (Playwright mobile+desktop). typecheck, lint e build OK.

- Neon criado: projeto `contaojogo` (id blue-hat-59034325, sa-east-1, PG17); migration aplicada; organização `contaojogo` semeada. `.env.local` preenchido (não versionar).
- Visual refeito no estilo Flashscore/Sofascore: MatchRow, CompetitionGroup, DateStrip, MatchFilterTabs, TeamCrest; home = central de jogos do dia.
- Testes: 16 unit, 6 E2E; `/api/health` = ok/up contra o Neon.

## Fase 2 — Autenticação, permissões e admin ✅ (2026-11-23)
- Better Auth (e-mail/senha, sessão 7d, rate limit, recuperação de senha via Resend; dev loga o link). Cadastro público sempre cria USER (perfil não aceito do cliente — testado).
- Perfis OWNER/ADMIN/OPERATOR/USER em `src/lib/auth/permissions.ts`; regras de troca/bloqueio (sem auto-alteração, ADMIN não toca ADMIN/OWNER, último OWNER protegido com lock de linha).
- `proxy.ts` (checagem otimista) + `requirePermission`/`authorizeAction` no servidor; perfil sempre lido do banco; bloqueio encerra sessões.
- Admin (amarelo): Painel com números reais, Usuários (busca, perfil, bloqueio), Auditoria paginada, Configurações (OWNER). Toda alteração gera audit_log com IP.
- `npm run owner:create -- --email --name --password` cria/promove o proprietário.
- Neon: branch `dev` para desenvolvimento/testes (.env.local); `main` = produção.
- Testes: 23 unit, 14 E2E (2 de login só no desktop por causa do rate limit). Promoção de perfil + auditoria verificadas no navegador.

## Pendências resolvidas (2026-11-23)
- Proprietário real criado em produção (main) e no dev: jassonmouragt@gmail.com.
- Resend removido: senha esquecida é redefinida pelo admin (Usuários → Redefinir senha, encerra sessões, auditado) ou `npm run user:set-password -- --email --password`.
- 2FA (TOTP + 8 códigos de backup) opcional em Admin → Minha conta; login pede código em /entrar/verificacao. Troca da própria senha em Minha conta. Migration 0001 aplicada em dev e main.
- Verificado no navegador: ativar 2FA, login com código errado recusado/correto aceito, desativar; reset pelo admin (nova senha 200, antiga 401).

## Fase 3 — Competições, equipes, atletas e agenda ✅ (2026-11-23)
- Schema (migration 0002): venues, teams, athletes, competitions (regras/pontuação/desempates), phases, groups, competition_teams, roster_entries, matches (cronômetro persistido + version p/ concorrência). CHECKs (mandante≠visitante, camisa 0–99) e índices de agenda.
- Admin: Competições (criar/editar regras, publicar), fases e grupos, inscrição de equipe copiando elenco ativo, agendamento com detecção de conflito de equipe/local (lock por organização), adiar/cancelar/reativar; Equipes + elenco; Locais; Agenda (30 dias). Tudo auditado.
- Portal: home com jogos reais (±3 dias), Campeonatos (abas), central da competição (resumo, jogos por dia, equipes), página da equipe (elenco sem dados pessoais), página do jogo. Só competições publicadas aparecem.
- Correções: ids de campo duplicados entre formulários; formulários não são mais limpos em caso de erro.
- Testes: 29 unit, 13 E2E (inclui fluxo completo admin → público com conflito de agenda).

## Fase 4 — Operação da partida ✅ (2026-11-23)
- Migration 0003: match_events (idempotência por client_event_id, anulação em vez de exclusão) e match_stats (CHECK no gol ≤ finalizações).
- Ações (`src/domain/match/actions.ts`): cronômetro (iniciar/pausar/retomar/encerrar tempo, versão otimista contra duplo aparelho), gol/cartão/substituição (atleta deve estar inscrito), desfazer, estatísticas, encerrar súmula (exige 2º tempo encerrado + estatísticas), confirmar/reabrir (somente ADMIN). Placar recalculado dos eventos; tudo auditado.
- Central do operador `/admin/jogos/[id]` (mobile-first, botões grandes, cronômetro local a partir do estado salvo). Página pública do jogo com artilheiros, estatísticas e linha do tempo.
- **MVP validado em E2E**: admin cria Mulungu x Gaspar → operador inicia → gol de Pedro Lima 18' → público vê 1-0 → estatísticas → encerra → admin confirma → público vê Finalizado.
- Testes: 32 unit, 13 E2E.

## Fase 5 — Tempo real no portal ✅ (2026-11-23)
- `LiveRefresher`: Ably (realtime gerenciado, token só-leitura em `/api/realtime/token`) quando `ABLY_API_KEY` existe; polling de reserva em `/api/public/live` (5s sem Ably, 60s com Ably, só com aba visível); confere estado ao reconectar (online/aba visível/reconexão Ably).
- Publicação só após commit (`publishMatchUpdate` em revalidateMatch); a mensagem carrega só um aviso — o cliente sempre busca o estado oficial, então mensagem perdida não gera inconsistência.
- Minuto e cronômetros andam no navegador a partir do estado salvo (um único intervalo compartilhado), sem requisição por segundo.
- E2E: público abre o jogo antes do gol e vê 1-0 e "Finalizado" sem recarregar. 34 unit, 13 E2E.

## Fase 6 — Classificação, artilharia e rankings ✅ (2026-11-23)
- `src/domain/standings/compute.ts` (puro, testado): pontos configuráveis; desempates em sequência (pontos, vitórias, saldo, gols pró, confronto direto recalculado só entre empatadas, menos cartões) e ordem alfabética estável; mata-mata fora da tabela.
- Só partidas CONFIRMADAS alimentam classificação, artilharia (sem gol contra; assistências) e disciplina.
- Central da competição com abas Jogos / Classificação (por grupo, zona de classificação) / Artilharia (pódio) / Disciplina / Equipes; página /ranking.
- Visual do site antigo: barra de navegação inferior no celular.
- E2E: após confirmar Mulungu 1x0, Mulungu lidera com 3 pts e Pedro Lima lidera a artilharia. 38 unit, 13 E2E.

## Fase 7 — Offline e sincronização ✅ (2026-11-23)
- Toda ação do operador (cronômetro, eventos, desfazer, estatísticas) entra numa fila no IndexedDB (`src/lib/offline`) e é enviada por `syncMatchOps`; a fila sobrevive a quedas e é reenviada ao voltar a conexão (evento online + a cada 15s).
- Idempotência: `match_sync_ops` (migration 0004) reserva cada client_op_id na mesma transação; reenvios viram "duplicado". Eventos usam o mesmo id.
- Conflitos: eventos só acrescentam; desfazer referencia o id do evento; estatísticas = mais recente pelo horário do aparelho; cronômetro aplica com o horário do toque (limitado entre o início do segmento e agora) e recusa transição impossível (ex.: dois aparelhos encerrando o mesmo tempo) com aviso ao operador.
- Tela otimista: placar, cronômetro e súmula já refletem a fila; itens marcados PENDENTE e aviso "Sem internet". Encerrar/confirmar súmula exige fila vazia.
- E2E: operador fica offline, lança cartão, volta a conexão, sincroniza e o público vê. 41 unit, 13 E2E.

## Fase 8 — Engajamento, patrocinadores, conteúdo e suporte ✅ (2026-11-23)
- Migration 0005: sponsors, sponsor_metrics (upsert por dia/posição), news_posts, documents, nomination_polls/nominations (1 por conta)/poll_finalists (3), support_tickets (número sequencial)/ticket_messages.
- Patrocínio: carrossel por posição (Início, Competição, Partida), tempo por banner (padrão 4s), período, ordenação ↑↓, pausar; visualizações em lote via sendBeacon (só com aba visível) e clique contado em /api/sponsors/[id]/click (só https). Relatório total + 7 dias + taxa de clique.
- Conteúdo: notícias com agendamento/expiração (texto puro, sem HTML → sem XSS), documentos por competição (aba Documentos).
- Engajamento: /indicacoes (torcedor logado indica 1 atleta; restrito aos inscritos quando há competição), moderação, admin publica 3 finalistas + link do Instagram. Voto popular não toca estatística oficial.
- Suporte: /suporte (anônimo ou logado, honeypot anti-robô, página de origem automática pelo botão flutuante "?" no celular, link do print), "Meus chamados" com respostas; /admin/suporte responde e muda situação.
- E2E: patrocinador exibido e clique contado (302), notícia publicada, chamado aberto/respondido/resolvido, 3 torcedores indicam → finalistas no portal. 41 unit, 14 E2E.

## Fase 9 — Segurança final, testes, backups e deploy (2026-11-23)
- Varredura: 100% das server actions checam sessão/permissão; nenhum HTML injetado; sem SQL cru.
- Novos: limite de taxa (suporte, indicações, métricas, polling), CSP + HSTS, exportação JSON do proprietário (Admin → Configurações), `shadcn` movido para devDependencies.
- Produção: migrations 0002–0005 aplicadas; snapshot `pre-lancamento-2026-11-23`. Agendamento de snapshot do Neon indisponível no plano → backup diário por GitHub Actions (`backup.yml`, pg_dump + verificação, 30 dias). CI em `ci.yml`.
- Docs: `docs/DEPLOY.md` (passo a passo Vercel, variáveis, domínio, restauração, checklist) e `docs/SECURITY.md`.
- Testes: 42 unit, 15 E2E (cabeçalhos, exportação restrita).
- **Pendente:** deploy — precisa do repositório no GitHub do proprietário + importação na Vercel (ver DEPLOY.md).

## Pendências
- Upload direto de imagens (logos, capas, prints): hoje são links https; com credenciais do Cloudflare R2 vira upload.
- Recarregar a página da operação sem internet ainda não funciona (precisaria de service worker/PWA) — manter a tela aberta durante o jogo.
- Suspensão automática por cartões (precisa da regra da organização: ex. 3 amarelos = 1 jogo) — hoje a disciplina só exibe contagens e marca expulsos.
- Chave visual do mata-mata (PDF p.7).
- `ABLY_API_KEY` (opcional): hoje roda por polling de 5s.
- Assistente de 5 etapas e geração automática de tabela (PDF p.18): hoje o cadastro é em uma tela + agendamento manual.
- Git não inicializado (pasta no OneDrive).

## Próximo: deploy na Vercel e itens pendentes acima.
