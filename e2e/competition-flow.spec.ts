import { expect as baseExpect, test } from "@playwright/test";

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
    test.setTimeout(120_000);
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

    for (const [team, player, shirt] of [[home, "Pedro Lima", "9"], [away, "Ryan", "10"], [third, "Carlos", "5"]] as const) {
      await page.goto("/admin/equipes");
      await page.getByRole("button", { name: "Nova equipe" }).click();
      await page.getByLabel("Nome da equipe").fill(team);
      await page.getByRole("button", { name: "Cadastrar" }).click();
      await page.waitForURL(/\/admin\/equipes\/[0-9a-f-]{36}$/);
      await page.getByLabel("Nome do atleta").fill(player);
      await page.getByLabel("Camisa").fill(shirt);
      await page.getByRole("button", { name: "Adicionar" }).click();
      await expect(page.getByText("Atleta cadastrado.").first()).toBeVisible();
    }

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

    for (const team of [home, away, third]) {
      await page.getByLabel("Equipe", { exact: true }).selectOption({ label: team });
      await page.getByRole("button", { name: "Inscrever com elenco" }).click();
      await expect(page.getByText(`${team} inscrita com 1 atleta(s).`).first()).toBeVisible();
    }

    await page.goto(`${compUrl}?aba=jogos`);
    const when = new Date(Date.now() + 60 * 60_000 - 3 * 3_600_000).toISOString().slice(0, 16);
    const schedule = async (h: string, a: string) => {
      await page.getByLabel("Mandante").selectOption({ label: h });
      await page.getByLabel("Visitante").selectOption({ label: a });
      await page.getByLabel("Data e hora (Brasília)").fill(when);
      await page.getByLabel("Local").selectOption({ label: `Arena ${tag}` });
      await page.getByRole("button", { name: "Agendar jogo" }).click();
    };
    await schedule(home, away);
    await expect(page.getByText("Jogo agendado.").first()).toBeVisible();
    await schedule(third, home); // formulário mantém data e local
    await expect(page.getByText(/Conflito: uma das equipes já joga/).first()).toBeVisible();

    const draft = await page.request.get("/campeonatos");
    expect(await draft.text()).not.toContain(compName);

    await page.getByRole("button", { name: "Publicar no site" }).click();
    await expect(page.getByText("Competição publicada no site.").first()).toBeVisible();

    await page.goto("/");
    await expect(page.getByText(compName).first()).toBeVisible();
    await page.getByRole("link", { name: new RegExp(home) }).first().click();
    await expect(page.getByText("Em breve").first()).toBeVisible();
    await expect(page.getByText(`Arena ${tag}`).first()).toBeVisible();

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

    await page.getByRole("button", { name: "+ GOL" }).click();
    await page.getByLabel("Atleta").selectOption({ label: "9 • Pedro Lima" });
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
    await page.getByLabel("Atleta").selectOption({ label: "9 • Pedro Lima" });
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
  });
});
