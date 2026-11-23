# Conta o Jogo — Especificação resumida

Fonte: `docs/reference/projeto_conta_o_jogo_layout_completo.pdf` (22 págs., lido integralmente) + prompt mestre do cliente. Consultar este resumo; reabrir o PDF só para detalhe visual.

## Produto
Plataforma tipo Flashscore alimentada manualmente por operadores. Uma única base PostgreSQL alimenta portal público, jogo ao vivo e painel admin. Domínio: contaojogo.club (admin em admin.contaojogo.club). Mobile-first.

## Identidade (PDF p.1)
- Fundo preto profundo com grade verde sutil; cards `#121614`, bordas discretas, raio grande.
- Verde vivo `#1ee37b` = ação, números, placar; lima `#8ef03c`; branco.
- Amarelo `#ffc857` = área admin/operador (pill ADMIN, placar na operação, botões de destaque).
- Azul `#4c9dff` = visitante nos comparativos; vermelho `#ff5b6b` = pill AO VIVO.
- Logo: bola em órbita + "contaojogo.club" + "FUTEBOL CONTADO EM NÚMEROS" (exibido sobre pílula branca). Rodapé: "Futebol contado em números".
- Marca editorial parceira: Gol de Placa (selo/rodapé de conteúdo).

## Direção visual (cliente, 23/11)
Layout semelhante a Flashscore/Sofascore nas cores da marca (verde escuro/neon, preto, branco): listas densas agrupadas por competição (faixa verde escura), linha de jogo com status/horário à esquerda, equipes empilhadas e placar à direita, vencedor em negrito, AO VIVO em vermelho; faixa de datas + filtros Todos/Ao vivo/Finalizados/Agendados; colunas laterais (competições à esquerda, patrocínio/destaques à direita no desktop). O PDF define conteúdo/módulos; a densidade e a navegação seguem Flashscore/Sofascore.

## Telas públicas
- **Início (03):** cabeçalho Início/Campeonatos/Jogos/Ranking/Suporte; destaque controlado pelo admin (campeonato, jogo, notícia ou votação); carrossel de patrocinadores (4s, link opcional); próximos jogos, últimos resultados, atalhos.
- **Patrocínio (04):** banner padrão 4s; posições Início, Competição, Partida; 1 link (site/WhatsApp/Instagram); relatório de impressões e cliques; tudo configurável.
- **Campeonatos (05):** abas Em andamento/Próximos/Finalizados; cartão com modalidade, fase, nº equipes, situação; busca e filtros (cidade, modalidade, temporada, organizador). Campo e futsal na mesma estrutura, regras/estatísticas próprias.
- **Central da competição (06):** capa, modalidade, fase, regulamento; resumo (equipes, jogos, gols, média) automático; abas Visão geral/Jogos/Classificação/Artilharia/Disciplina/Documentos; patrocinadores.
- **Classificação (07):** grupos com #, equipe, J, SG, PTS; só resultados confirmados; desempate configurável (pontos • saldo • gols pró • confronto); cores classificado/atenção/eliminado; mata-mata vira chave (oitavas→final).
- **Agenda (08):** faixa de dias; filtro data/fase/grupo/equipe/local/situação; card com horário, confronto, arena, mudança de horário; compartilhar; vira AO VIVO.
- **Ao vivo (09):** pill AO VIVO • minuto; placar com autores dos gols; cronômetros BOLA ROLANDO / BOLA PARADA / ATUALIZAÇÃO; comparativo finalizações, no gol, escanteios, impedimentos, cartões; timeline.
- **Finalizada (10):** admin confirma placar e fecha súmula antes da publicação definitiva; gols com atleta, minuto, assistência, observação; arte para Stories/WhatsApp; posse estimada.
- **Timeline (11):** eventos GOL (assistência, contra, pênalti, falta), CARTÃO (motivo, atleta ou comissão), INTERVALO, SUBSTITUIÇÃO; filtro por tipo; correções auditadas.
- **Equipe (12):** escudo, cidade, comissão, contatos, competições; elenco (#, atleta, pos, J, G, cartões, situação); agenda da equipe; indicadores. Dados sensíveis só se autorizados.
- **Rankings (13):** artilharia (pódio), disciplina (amarelos/vermelhos), suspensão automática; extras: assistências, defesas, jogos sem sofrer gol; filtros.
- **Pré-jogo (14):** escalação provável/confirmada, formação, banco, capitão, comissão; desfalques (suspensão, lesão, ausência, documental), visibilidade decidida pelo admin; após início só operador altera.
- **Engajamento (15):** PDF mostra votação no site; **regra do cliente prevalece**: público indica atletas no site, admin escolhe 3 finalistas, votação final externa no Instagram. Voto popular nunca mistura com estatística oficial.
- **Suporte (16):** botão fixo no cabeçalho e flutuante no celular; tipos: acesso, erro em jogo, falar com suporte; anexo de print + página de origem; chamado com número, situação, histórico; canal/horário configurável.

## Admin
- **Painel (17):** jogos hoje, ao vivo, pendentes, próximas ações, chamados, acessos (7 dias); atalhos de cadastro; perfis OWNER/ADMIN/OPERATOR/(equipe); auditoria de tudo; proprietário tem acesso total e remove colaboradores.
- **Nova competição (18):** assistente 5 etapas (Dados, Formato, Equipes, Tabela, Publicar); modalidade, sistema (grupos+mata-mata, ida/volta), nº grupos, desempate, regras (cartões/suspensões, faltas acumuladas, pênaltis, WO automático); importar equipes/atletas de temporadas anteriores; tabela automática ou manual; prévia valida conflitos de horário/equipe/local.
- **Operação (19):** botões grandes + GOL, + CARTÃO, + FINALIZAÇÃO, + ESCANTEIO, + IMPEDIMENTO, + SUBSTITUIÇÃO; pausar/retomar; último evento + Desfazer; campos mínimos (equipe, atleta, minuto, detalhe); modo conferência; fechamento exige resultado, finalizações, no gol, escanteios, cartões, impedimentos e tempos. Offline com sincronização.
- **Conteúdo (20):** banners (logo, link, datas, posição, duração, ordenação por arraste), notícias, destaques, enquetes, documentos, agendamento/expiração, relatório por patrocinador.
- **Segurança (21):** 2FA, perfis separados, registro de alterações, backup automático testado, exportação de dados, ambiente de teste, documentação; proprietário controla domínio, hospedagem, banco, código.

## Regras do cliente (prompt)
- Operador inicia/pausa/encerra; cronômetro por timestamps persistidos, sem request por segundo.
- Gol imediato (equipe, atleta, minuto) → placar e página pública.
- Estatísticas manuais, tipicamente a cada 10–15 min, sem intervalo obrigatório.
- Admin confirma resultado antes de alimentar classificação oficial.
- Realtime só após persistência; recuperação de estado após reconexão; eventos idempotentes; controle de concorrência.
- Sem mocks em produção, botões decorativos ou métricas fictícias.

## MVP
Admin cria Mulungu x Gaspar → operador inicia cronômetro → gol com atleta/minuto → público vê placar → estatísticas → encerra → admin confirma → resultado salvo.

## Decisões técnicas
Next.js 16 (App Router, Cache Components, `proxy.ts` no lugar de middleware), TS strict, Tailwind 4, shadcn/ui (base-ui), Neon + Drizzle (driver WebSocket p/ transações), Better Auth, Zod 4, R2, Vercel, realtime gerenciado (Ably previsto), Vitest + Playwright. `organization_id` em todas as tabelas de domínio.
