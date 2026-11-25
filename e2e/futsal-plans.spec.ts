import { expect as baseExpect, test } from "@playwright/test";

const expect = baseExpect.configure({ timeout: 15_000 });

/** Futsal (cronômetro único, faltas, tempo técnico, mesa) + pênaltis + planos para clubes. */
test.describe("futsal, pênaltis e planos", () => {
  test.skip(!process.env.E2E_OWNER_EMAIL, "E2E_OWNER_EMAIL não definido");
  test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "somente desktop"));

  test("final de futsal decidida nos pênaltis", async ({ page }) => {
    test.setTimeout(240_000);
    const tag = Date.now().toString(36).slice(-5).toUpperCase();
    const home = `Leões ${tag}`, away = `Tubarões ${tag}`, compName = `Copa Futsal ${tag}`;
    const ok = (msg: string | RegExp) => expect(page.getByText(msg).last()).toBeVisible();

    await page.goto("/entrar?next=/admin/equipes");
    await page.getByLabel("E-mail").fill(process.env.E2E_OWNER_EMAIL!);
    await page.getByLabel("Senha").fill(process.env.E2E_OWNER_PASSWORD!);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL((u) => u.pathname === "/admin/equipes");

    for (const t of [home, away]) {
      await page.goto("/admin/equipes");
      await page.getByRole("button", { name: "Nova equipe" }).click();
      await page.getByLabel("Nome da equipe").fill(t);
      await page.getByRole("button", { name: "Criar equipe e adicionar atletas" }).click();
      await page.waitForURL(/\/admin\/equipes\/[0-9a-f-]{36}$/);
      await page.getByLabel("Nome do atleta").fill(`Fixo ${tag}`);
      await page.getByRole("button", { name: "Adicionar atleta" }).click();
      await ok("Atleta cadastrado.");
    }

    await page.goto("/admin/competicoes");
    await page.getByRole("button", { name: "Nova competição" }).click();
    await page.getByLabel("Nome da competição").fill(compName);
    await page.getByLabel("Modalidade").selectOption({ label: "Futsal" });
    await page.getByRole("button", { name: "Criar competição" }).click();
    await page.waitForURL(/\/admin\/competicoes\/[0-9a-f-]{36}$/);
    const compUrl = page.url();

    await page.goto(`${compUrl}?aba=regulamento`);
    await expect(page.getByLabel("Minutos por tempo")).toHaveValue("20");
    await expect(page.getByLabel("Intervalo (minutos)")).toHaveValue("10");
    await expect(page.getByLabel("Tempos técnicos por tempo")).toHaveValue("1");

    await page.goto(`${compUrl}?aba=equipes`);
    for (const t of [home, away]) {
      await page.getByLabel("Equipe", { exact: true }).selectOption({ label: t });
      await page.getByRole("button", { name: "Inscrever com elenco" }).click();
      await ok(`${t} inscrita com 1 atleta(s).`);
    }
    // Atleta cadastrado depois da inscrição entra sozinho no elenco
    await page.goto("/admin/equipes");
    await page.getByRole("link", { name: new RegExp(home) }).first().click();
    await page.getByLabel("Nome do atleta").fill(`Ala ${tag}`);
    await page.getByRole("button", { name: "Adicionar atleta" }).click();
    await ok("Atleta cadastrado.");

    await page.goto(`${compUrl}?aba=jogos`);
    await page.getByLabel("Mandante").selectOption({ label: home });
    await page.getByLabel("Visitante").selectOption({ label: away });
    await page.getByLabel("Data e hora (Brasília)").fill(new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 16));
    await page.getByLabel("Fase").selectOption({ label: "Final" });
    await page.getByLabel("1º árbitro").fill("Ana Souza");
    await page.getByLabel("2º árbitro").fill("Bia Lima");
    await page.getByLabel("Anotador").fill("Caio Reis");
    await page.getByLabel("Cronometrista (mesário)").fill("Davi Melo");
    await page.getByRole("button", { name: "Agendar jogo" }).click();
    await expect(page.locator("[data-sonner-toast]", { hasText: "Jogo agendado." })).toBeVisible();
    await page.goto(`${compUrl}?aba=resumo`);
    await page.getByRole("button", { name: /Publicar/ }).first().click();

    await page.goto(`${compUrl}?aba=jogos`);
    await page.locator("li", { hasText: `${home} x ${away}` }).getByRole("link", { name: "Operar" }).click();
    await page.waitForURL(/\/admin\/jogos\/[0-9a-f-]{36}$/);
    const matchId = page.url().split("/admin/jogos/")[1];

    // Cronômetro único do futsal: anda com a bola rolando e para quando para
    await page.getByRole("button", { name: "Iniciar 1º tempo" }).click();
    await ok("Cronômetro atualizado.");
    await page.getByRole("button", { name: "⏸ Parar cronômetro" }).click();
    await expect(page.getByText("Cronômetro parado")).toBeVisible();
    await page.getByRole("button", { name: "▶ Bola rolando" }).click();
    await expect(page.getByText("Cronômetro parado")).toHaveCount(0);

    // Faltas acumuladas: a 6ª dá tiro livre direto
    const homeFoul = page.getByRole("button", { name: "+ Falta" }).first();
    for (let i = 0; i < 6; i++) { await homeFoul.click(); await page.waitForTimeout(300); }
    await expect(page.getByText("Tiro livre direto a cada falta")).toBeVisible({ timeout: 20_000 });

    // Tempo técnico: para o cronômetro e só 1 por tempo
    await page.getByRole("button", { name: /Tempo técnico \(0\/1\)/ }).first().click();
    await expect(page.getByText(/aguardando envio/)).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByText("Cronômetro parado")).toBeVisible();
    await expect(page.getByRole("button", { name: /Tempo técnico \(1\/1\)/ }).first()).toBeDisabled();

    await page.getByRole("button", { name: "+ AMARELO" }).click();
    await page.getByRole("button", { name: home, exact: true }).click();
    await expect(page.getByLabel("Atleta").locator("option", { hasText: `Ala ${tag}` })).toHaveCount(1);
    await page.getByRole("button", { name: "Cancelar" }).click();

    const pub = await page.context().newPage();
    await pub.goto(`/jogos/${matchId}`);
    await expect(pub.getByText("Tiro livre direto").first()).toBeVisible();
    await expect(pub.getByText("Ana Souza (1º árbitro) · Bia Lima (2º árbitro) · Caio Reis (anotador) · Davi Melo (cronometrista)")).toBeVisible();
    await expect(pub.getByText("Quadra ao vivo")).toBeVisible();

    await page.getByRole("button", { name: "Encerrar 1º tempo" }).click();
    await ok("Cronômetro atualizado.");
    await expect(page.getByText("Intervalo · 10 min")).toBeVisible();
    await page.getByRole("button", { name: "Iniciar 2º tempo" }).click();
    await ok("Cronômetro atualizado.");
    await page.getByRole("button", { name: "Encerrar 2º tempo" }).click();
    await ok("Cronômetro atualizado.");

    // Empate em mata-mata: súmula exige pênaltis
    await page.getByRole("button", { name: `Aumentar Finalizações ${home}` }).click();
    await page.getByRole("button", { name: "Salvar estatísticas" }).click();
    await ok(/Estatísticas salvas|sincronizados/);
    await expect(page.getByText(/aguardando envio/)).toHaveCount(0);
    await page.getByRole("button", { name: "Encerrar súmula" }).click();
    await ok(/registre a disputa de pênaltis/);

    const board = page.locator("section", { hasText: "Disputa de pênaltis" });
    await board.getByLabel(`Cobrador ${home}`).selectOption({ label: `Fixo ${tag}` });
    const [hGoal, aGoal] = [board.getByRole("button", { name: "✓ Converteu" }).first(), board.getByRole("button", { name: "✓ Converteu" }).last()];
    const aMiss = board.getByRole("button", { name: "✗ Perdeu" }).last();
    for (const b of [hGoal, aGoal, hGoal, aMiss, hGoal, aMiss, hGoal]) { await b.click(); await page.waitForTimeout(400); }
    await expect(page.getByText(`${home} vence nos pênaltis por 4 a 1`)).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: "Encerrar súmula" }).click();
    await ok(/Aguardando conferência/);
    await expect(pub.getByText("Pênaltis: 4 x 1")).toBeVisible({ timeout: 25_000 });
    await expect(pub.getByLabel(`Cobranças de ${home}`).locator("li", { hasText: "✓" })).toHaveCount(4);
    await expect(pub.getByText(`1. Fixo ${tag} ✓`).first()).toBeVisible();
  });

  test("clube assina um plano e o dono libera o painel", async ({ page, browser }) => {
    test.setTimeout(180_000);
    const tag = Date.now().toString(36).slice(-5).toUpperCase();
    await page.goto("/entrar?next=/admin/planos");
    await page.getByLabel("E-mail").fill(process.env.E2E_OWNER_EMAIL!);
    await page.getByLabel("Senha").fill(process.env.E2E_OWNER_PASSWORD!);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL((u) => u.pathname === "/admin/planos");
    await page.getByRole("button", { name: "Novo plano" }).click();
    await page.getByLabel("Nome do plano").fill(`Liga ${tag}`);
    await page.getByLabel("Preço (R$)").fill("49,90");
    await page.getByLabel("Benefícios (um por linha)").fill("Operação ao vivo\nCampinho virtual");
    await page.getByRole("button", { name: "Criar plano" }).click();
    await expect(page.getByText("Plano criado.").first()).toBeVisible();

    const anon = await browser.newContext();
    const v = await anon.newPage();
    await v.goto("/planos");
    await v.locator("article", { hasText: `Liga ${tag}` }).getByRole("link", { name: "Assinar" }).click();
    const email = `clube.${tag.toLowerCase()}@example.com`;
    await v.getByLabel("Nome do clube ou da liga").fill(`Liga Teste ${tag}`);
    await v.getByLabel("Seu nome").fill("Responsável Teste");
    await v.getByLabel("E-mail (será o seu login)").fill(email);
    await v.getByLabel("WhatsApp com DDD").fill("88999990000");
    await v.getByLabel("Senha").fill("senhaforte123");
    await v.getByRole("button", { name: "Criar conta e assinar" }).click();
    await v.waitForURL(/\/planos\/obrigado/);
    await expect(v.getByText("Cadastro recebido!")).toBeVisible();

    await page.goto("/admin/assinaturas");
    const row = page.locator("li", { hasText: `Liga Teste ${tag}` });
    await expect(row).toContainText("Aguardando pagamento");
    await row.getByRole("button", { name: "Ativar" }).click();
    await expect(page.getByText(/acesso ao painel liberado/).first()).toBeVisible();
    await page.reload();
    await expect(page.locator("li", { hasText: `Liga Teste ${tag}` })).toContainText("Ativa");

    // O responsável entra e tem o painel do clube (sem as áreas do portal)
    const c = await anon.newPage();
    await c.goto("/entrar?next=/admin/competicoes");
    await c.getByLabel("E-mail").fill(email);
    await c.getByLabel("Senha").fill("senhaforte123");
    await c.getByRole("button", { name: "Entrar" }).click();
    await c.waitForURL((u) => u.pathname === "/admin/competicoes");
    await expect(c.getByRole("link", { name: "Competições" }).first()).toBeVisible();
    await expect(c.getByRole("link", { name: "Banners do topo" })).toHaveCount(0);
    await expect(c.getByRole("link", { name: "Planos" })).toHaveCount(0);
    await c.goto("/admin/banners");
    await expect(c.getByText("Sem permissão").first()).toBeVisible();
    await anon.close();
  });
});
