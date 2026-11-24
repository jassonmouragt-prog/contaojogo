import { expect as baseExpect, test } from "@playwright/test";
import sharp from "sharp";

// Ações gravam no banco remoto com auditoria; damos folga à latência de rede.
const expect = baseExpect.configure({ timeout: 15_000 });

/**
 * Fluxo do administrador da Fase 3: equipes → atletas → local → competição →
 * inscrições → agendamento (com conflito) → publicação → portal público.
 * Usa nomes únicos para poder rodar repetidamente no banco de desenvolvimento.
 */
test.describe("cadastro de competição e agenda", () => {
  test.skip(!process.env.E2E_OWNER_EMAIL, "E2E_OWNER_EMAIL não definido");
  test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "somente desktop"));

  test("admin monta a competição e o público vê o jogo", async ({ page }) => {
    test.setTimeout(240_000);
    const tag = Date.now().toString(36).slice(-5).toUpperCase();
    const home = `Mulungu ${tag}`;
    const away = `Gaspar ${tag}`;
    const third = `Tricolor ${tag}`;
    const compName = `Copa Teste ${tag}`;

    await page.goto("/entrar?next=/admin/equipes");
    await page.getByLabel("E-mail").fill(process.env.E2E_OWNER_EMAIL!);
    await page.getByLabel("Senha").fill(process.env.E2E_OWNER_PASSWORD!);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL((u) => u.pathname === "/admin/equipes");

    const crest = await sharp({ create: { width: 900, height: 900, channels: 4, background: "#1ee37b" } }).png().toBuffer();
    for (const [team, player] of [[home, "Pedro Lima"], [away, "Ryan"]] as const) {
      await page.goto("/admin/equipes");
      await page.getByRole("button", { name: "Nova equipe" }).click();
      await page.locator('input[type="file"]').setInputFiles({ name: "escudo.png", mimeType: "image/png", buffer: crest });
      await expect(page.getByText(/Otimizada:/).first()).toBeVisible({ timeout: 30_000 });
      await page.getByLabel("Nome da equipe").fill(team);
      await page.getByRole("button", { name: "Criar equipe e adicionar atletas" }).click();
      await page.waitForURL(/\/admin\/equipes\/[0-9a-f-]{36}$/);
      await expect(page.getByAltText("Pré-visualização").first()).toBeVisible();
      await page.getByLabel("Nome do atleta").fill(player);
      await page.getByLabel("Posição").selectOption({ label: "Lateral esquerdo" });
      await page.getByRole("button", { name: "Adicionar atleta" }).click();
      await expect(page.getByText("Atleta cadastrado.").first()).toBeVisible();
    }
    await page.goto("/admin/equipes");
    await page.getByRole("button", { name: "Nova equipe" }).click();
    await page.getByLabel("Nome da equipe").fill(third);
    await page.getByRole("button", { name: "Criar equipe e adicionar atletas" }).click();
    await page.waitForURL(/\/admin\/equipes\/[0-9a-f-]{36}$/);
    await page.getByRole("button", { name: "Colar lista" }).click();
    await page.getByLabel(/Um atleta por linha/).fill("5 Carlos\n7 - Marcos Silva");
    await page.getByRole("button", { name: "Adicionar todos" }).click();
    await expect(page.getByText("2 atleta(s) adicionado(s).").first()).toBeVisible();
    await expect(page.getByText("Marcos Silva")).toBeVisible();

    await page.goto("/admin/locais");
    await page.getByRole("button", { name: "Novo local" }).click();
    await page.getByLabel("Nome do local").fill(`Arena ${tag}`);
    await page.getByRole("button", { name: "Cadastrar" }).click();
    await expect(page.getByText("Local cadastrado.").first()).toBeVisible();

    await page.goto("/admin/competicoes");
    await page.getByRole("button", { name: "Nova competição" }).click();
    await page.getByLabel("Nome da competição").fill(compName);
    await page.getByRole("button", { name: "Criar competição" }).click();
    await page.waitForURL(/\/admin\/competicoes\/[0-9a-f-]{36}$/);
    const compUrl = page.url();
    await expect(page.getByText("1. Inscrever as equipes").first()).toBeVisible();
    await page.goto(`${compUrl}?aba=equipes`);

    for (const [team, n] of [[home, 1], [away, 1], [third, 2]] as const) {
      await page.getByLabel("Equipe", { exact: true }).selectOption({ label: team });
      await page.getByRole("button", { name: "Inscrever com elenco" }).click();
      await expect(page.getByText(`${team} inscrita com ${n} atleta(s).`).first()).toBeVisible();
    }

    await page.goto(`${compUrl}?aba=jogos`);
    const when = new Date(Date.now() + 5 * 86_400_000 - 3 * 3_600_000).toISOString().slice(0, 16);
    const schedule = async (h: string, a: string) => {
      await page.getByLabel("Mandante").selectOption({ label: h });
      await page.getByLabel("Visitante").selectOption({ label: a });
      await page.getByLabel("Data e hora (Brasília)").fill(when);
      await page.getByLabel("Local").selectOption({ label: `Arena ${tag}` });
      await page.getByRole("button", { name: "Agendar jogo" }).click();
    };
    await page.getByLabel("Árbitro").fill("Anderson Daronco");
    await page.getByLabel("Auxiliar 1").fill("Bruno Boschilia");
    await page.getByLabel("Auxiliar 2").fill("Rodrigo Corrêa");
    await schedule(home, away);
    await expect(page.getByText("Jogo agendado.").first()).toBeVisible();
    await schedule(third, home); // formulário mantém data e local
    await expect(page.getByText(/Conflito: uma das equipes já joga/).first()).toBeVisible();
    // Final: fase de mata-mata criada direto no cadastro do jogo (não entra na classificação)
    await page.getByLabel("Mandante").selectOption({ label: third });
    await page.getByLabel("Visitante").selectOption({ label: away });
    await page.getByLabel("Data e hora (Brasília)").fill(new Date(Date.now() + 9 * 86_400_000 - 3 * 3_600_000).toISOString().slice(0, 16));
    await page.getByLabel("Fase").selectOption({ label: "Final" });
    await page.getByRole("button", { name: "Agendar jogo" }).click();
    await expect(page.locator("[data-sonner-toast]", { hasText: "Jogo agendado." })).toBeVisible();
    await expect(async () => {
      await page.reload();
      await expect(page.locator("li", { hasText: `${third} x ${away}` }).first()).toContainText("Final", { timeout: 3000 });
    }).toPass({ timeout: 30_000 });
    await expect(page.getByLabel("Fase").locator("option", { hasText: /^Final$/ })).toHaveCount(1);

    const draft = await page.request.get("/campeonatos");
    expect(await draft.text()).not.toContain(compName);

    await page.getByRole("button", { name: "Publicar no site" }).click();
    await expect(page.getByText("Competição publicada no site.").first()).toBeVisible();

    await page.goto("/campeonatos");
    await page.getByRole("link", { name: new RegExp(compName) }).click();
    await page.getByRole("link", { name: new RegExp(home) }).first().click();
    await expect(page.getByText("Em breve").first()).toBeVisible();
    await expect(page.getByText(`Arena ${tag}`).first()).toBeVisible();
    await expect(page.getByText("Anderson Daronco (árbitro) · Bruno Boschilia e Rodrigo Corrêa (auxiliares)")).toBeVisible();
    await expect(page.getByRole("link", { name: "Falar no WhatsApp" })).toHaveAttribute("href", "https://wa.me/5588999247743");

    await page.goto("/campeonatos");
    await page.getByRole("link", { name: new RegExp(compName) }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(compName);
    await page.getByRole("link", { name: "Equipes", exact: true }).click();
    await page.getByRole("link", { name: new RegExp(`^${away}`) }).last().click();
    await page.waitForURL(/\/equipes\//);
    await expect(page.getByText("Ryan").first()).toBeVisible();

    // ===== Fase 4 — MVP: operador conduz a partida =====
    await page.goto("/admin/jogos");
    await page.locator("li", { hasText: `${home} x ${away}` }).getByRole("link", { name: "Operar" }).click();
    await page.waitForURL(/\/admin\/jogos\/[0-9a-f-]{36}$/);
    const matchUrl = page.url().replace("/admin/jogos/", "/jogos/");
    const ok = (msg: string | RegExp) => expect(page.getByText(msg).last()).toBeVisible();

    await page.getByRole("button", { name: "Iniciar 1º tempo" }).click();
    await ok("Cronômetro atualizado.");
    await expect(page.getByRole("button", { name: "Pausar (bola parada)" })).toBeVisible();

    // Público abre a partida ANTES do gol e não recarrega mais a página (Fase 5).
    const pub = await page.context().newPage();
    await pub.goto(matchUrl);
    await expect(pub.getByText(/Ao vivo/)).toBeVisible();
    await expect(pub.getByText("Bola rolando")).toBeVisible();

    const homeTab = await page.context().newPage();
    await homeTab.goto("/");
    await expect(homeTab.locator("section", { hasText: compName.toUpperCase() }).getByText(home).first()).toBeVisible();
    await homeTab.getByRole("tab", { name: /Ao vivo/ }).click();
    await expect(homeTab.getByText(home).first()).toBeVisible();
    await homeTab.close();

    await page.getByRole("button", { name: "+ GOL" }).click();
    await page.getByLabel("Atleta").selectOption({ label: "Pedro Lima" });
    await page.getByLabel("Minuto").fill("18");
    await page.getByRole("button", { name: "Registrar" }).click();
    await ok("Evento registrado.");
    await expect(page.getByText("1 - 0").first()).toBeVisible();

    // Atualização automática (polling 5s sem Ably / instantânea com Ably)
    await expect(pub.getByText("1 - 0")).toBeVisible({ timeout: 20_000 });
    await expect(pub.getByText("Pedro Lima 18'")).toBeVisible();

    // Estatísticas
    await page.getByRole("button", { name: `Aumentar Finalizações ${home}` }).click();
    await page.getByRole("button", { name: `Aumentar Finalizações ${home}` }).click();
    await page.getByRole("button", { name: `Aumentar Chutes no gol ${home}` }).click();
    await page.getByRole("button", { name: `Aumentar Escanteios ${away}` }).click();
    await page.getByRole("button", { name: "Salvar estatísticas" }).click();
    await ok("Estatísticas salvas.");

    // ===== Fase 7 — operador perde a internet e continua lançando =====
    await page.context().setOffline(true);
    await page.getByRole("button", { name: "+ AMARELO" }).click();
    await page.getByLabel("Atleta").selectOption({ label: "Pedro Lima" });
    await page.getByLabel("Minuto").fill("30");
    await page.getByRole("button", { name: "Registrar" }).click();
    await expect(page.getByText(/Sem internet/).first()).toBeVisible();
    await expect(page.getByText("PENDENTE").first()).toBeVisible();
    await expect(page.getByText(/1 lançamento\(s\) aguardando envio/).first()).toBeVisible();
    // Recarregar sem internet não é possível; a fila fica no IndexedDB. Volta a conexão:
    await page.context().setOffline(false);
    await expect(page.getByText("PENDENTE")).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByText(/aguardando envio/)).toHaveCount(0);
    await expect(pub.getByText("Cartões amarelos")).toBeVisible({ timeout: 20_000 });

    // Fechar súmula antes do fim é recusado
    await page.getByRole("button", { name: "Encerrar 1º tempo" }).click();
    await ok("Cronômetro atualizado.");
    await page.getByRole("button", { name: "Iniciar 2º tempo" }).click();
    await ok("Cronômetro atualizado.");
    await page.getByRole("button", { name: "Encerrar 2º tempo" }).click();
    await ok("Cronômetro atualizado.");
    await page.getByRole("button", { name: "Encerrar súmula" }).click();
    await ok(/Aguardando conferência/);

    // Administrador confirma
    await page.getByRole("button", { name: "Confirmar resultado" }).click();
    await ok("Resultado confirmado e publicado.");

    await expect(pub.getByText("Finalizado")).toBeVisible({ timeout: 20_000 });
    await expect(pub.getByText("1 - 0")).toBeVisible();
    await expect(pub.getByText("Finalizações")).toBeVisible();

    // ===== Fase 6 — resultado confirmado alimenta classificação e artilharia =====
    await pub.goto("/campeonatos");
    await pub.getByRole("link", { name: new RegExp(compName) }).click();
    await pub.getByRole("link", { name: "Classificação" }).click();
    const leader = pub.locator("tbody tr").first();
    await expect(leader).toContainText(home);
    await expect(leader).toContainText("3");
    await pub.getByRole("link", { name: "Artilharia" }).click();
    await expect(pub.locator("tbody tr").first()).toContainText("Pedro Lima");

    // Artilharia também na página da equipe e no admin
    await pub.locator("tbody tr").first().getByRole("link", { name: home }).click();
    await expect(pub.getByRole("heading", { name: "Artilheiros" })).toBeVisible();
    await expect(pub.locator("ol li").first()).toContainText("Pedro Lima");
    await page.goto(`${compUrl}?aba=artilharia`);
    await expect(page.locator("tbody tr").first()).toContainText("Pedro Lima");
  });
});
