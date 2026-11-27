import { expect as baseExpect, test, type Browser, type Page } from "@playwright/test";
import sharp from "sharp";

/** Foto "pesada" (ruído, 3000×2000, JPEG ~3 MB) para testar a compressão. */
async function bigPhoto() {
  const w = 3000, h = 2000;
  const raw = Buffer.alloc(w * h * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 2654435761) >>> 24;
  return sharp(raw, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 95 }).toBuffer();
}

const expect = baseExpect.configure({ timeout: 15_000 });

async function loginOwner(page: Page, next: string) {
  await page.goto(`/entrar?next=${next}`);
  await page.getByLabel("E-mail").fill(process.env.E2E_OWNER_EMAIL!);
  await page.getByLabel("Senha").fill(process.env.E2E_OWNER_PASSWORD!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((u) => u.pathname === next);
}

async function fan(browser: Browser, baseURL: string, tag: string, i: number) {
  const ctx = await browser.newContext({ baseURL });
  const page = await ctx.newPage();
  await page.goto("/cadastro");
  await page.getByLabel("Nome").fill(`Torcedor ${i} ${tag}`);
  await page.getByLabel("E-mail").fill(`fan${i}-${tag.toLowerCase()}@teste.contaojogo.club`);
  await page.getByLabel("Senha", { exact: true }).fill("senha-forte-123");
  await page.getByLabel("Confirmar senha").fill("senha-forte-123");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  return { ctx, page };
}

test.describe("Fase 8 — engajamento, patrocínio, conteúdo e suporte", () => {
  test.skip(!process.env.E2E_OWNER_EMAIL, "E2E_OWNER_EMAIL não definido");
  test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "somente desktop"));

  test("fluxos completos", async ({ page, browser, baseURL }) => {
    test.setTimeout(240_000);
    const tag = Date.now().toString(36).slice(-5).toUpperCase();

    // --- Patrocínio: cadastro → exibição → clique contado
    await loginOwner(page, "/admin/patrocinadores");
    await page.getByRole("button", { name: "Novo patrocinador" }).click();
    await page.getByLabel("Nome", { exact: true }).fill(`Laticínios ${tag}`);
    const photo = await bigPhoto();
    await page.locator('input[type="file"]').setInputFiles({ name: "logo.jpg", mimeType: "image/jpeg", buffer: photo });
    await expect(page.getByText(/Imagem otimizada: .* → \d+ KB • 600×400/).first()).toBeVisible({ timeout: 30_000 });
    await page.getByLabel(/Link ao clicar/).fill("https://example.com/");
    await page.getByRole("button", { name: "Cadastrar patrocinador" }).click();
    await expect(page.getByText("Patrocinador cadastrado.").first()).toBeVisible();

    const anon = await browser.newContext({ baseURL });
    const visitor = await anon.newPage();
    await visitor.goto("/");
    const banner = visitor.getByRole("link", { name: new RegExp(`Laticínios ${tag}`) });
    // pode haver outros patrocinadores rodando: espera o nosso aparecer (troca a cada 4s)
    await expect(banner).toBeVisible({ timeout: 40_000 });
    const href = await banner.getAttribute("href");
    const click = await anon.request.get(href!, { maxRedirects: 0 });
    expect(click.status()).toBe(302);
    expect(click.headers()["location"]).toBe("https://example.com/");
    await page.reload();
    await expect(page.locator("li", { hasText: `Laticínios ${tag}` })).toContainText("1 cliques");

    // Editar o patrocinador sem recriar: nome muda, logo é mantido
    const row = page.locator("li", { hasText: `Laticínios ${tag}` });
    const oldLogo = await row.locator("img").first().getAttribute("src");
    await row.getByRole("button", { name: "Editar" }).click();
    await row.getByLabel("Nome", { exact: true }).fill(`Laticínios ${tag} Ltda`);
    await row.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText("Patrocinador salvo.").first()).toBeVisible();
    await expect(page.locator("li", { hasText: `Laticínios ${tag} Ltda` }).locator("img").first()).toHaveAttribute("src", oldLogo!);

    // logo servido pelo próprio site, em WebP e com cache longo
    const logoSrc = await page.locator("li", { hasText: `Laticínios ${tag}` }).locator("img").getAttribute("src");
    expect(logoSrc).toMatch(/^\/api\/media\/[0-9a-f-]{36}$/);
    const logo = await page.request.get(logoSrc!);
    expect(logo.headers()["content-type"]).toBe("image/webp");
    expect(logo.headers()["cache-control"]).toContain("immutable");
    expect((await logo.body()).length).toBeLessThan(photo.length / 5);

    // --- Banner do topo com imagem anexada
    await page.goto("/admin/banners");
    await page.getByRole("button", { name: "Novo banner" }).click();
    await page.getByLabel("Título (opcional)", { exact: true }).fill(`Final ${tag}`);
    await page.locator('input[type="file"]').first().setInputFiles({ name: "banner.jpg", mimeType: "image/jpeg", buffer: photo });
    await expect(page.getByText(/Imagem otimizada: .* • 1620×1080/).first()).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Publicar banner" }).click();
    await expect(page.getByText("Banner publicado.").first()).toBeVisible();
    // formulário limpo para o próximo cadastro (inclusive a imagem anexada)
    await expect(page.getByRole("button", { name: "Novo banner" })).toBeVisible(); // painel fechou limpo
    await expect(page.getByAltText("Pré-visualização")).toHaveCount(0);
    await expect(page.getByText(/Imagem otimizada/)).toHaveCount(0);
    await visitor.goto("/");
    await expect(visitor.getByRole("heading", { name: `Final ${tag}` }).or(visitor.getByText(`Final ${tag}`))).toBeAttached({ timeout: 30_000 });
    await page.locator("li", { hasText: `Final ${tag}` }).getByRole("button", { name: "Pausar" }).click();

    // --- Conteúdo: notícia publicada aparece no portal
    await page.goto("/admin/conteudo");
    await page.getByRole("button", { name: "Nova notícia" }).click();
    await page.getByLabel("Título", { exact: true }).first().fill(`Mulungu vence clássico ${tag}`);
    await page.getByLabel("Texto").fill("Com gol de Pedro Lima, o Mulungu venceu o Gaspar.");
    await page.getByRole("button", { name: "Salvar notícia" }).click();
    await expect(page.getByText("Notícia salva.").first()).toBeVisible();
    await visitor.goto("/noticias");
    await visitor.getByRole("link", { name: new RegExp(`Mulungu vence clássico ${tag}`) }).click();
    await expect(visitor.getByText("Com gol de Pedro Lima").first()).toBeVisible();

    // --- Suporte: visitante abre chamado, equipe responde e resolve
    await visitor.goto("/suporte?tipo=MATCH_ERROR&pagina=/jogos/x");
    await visitor.getByLabel("Nome").fill(`Visitante ${tag}`);
    await visitor.getByLabel("E-mail").fill("visitante@teste.contaojogo.club");
    await visitor.getByLabel("Mensagem").fill(`Placar errado no jogo ${tag}`);
    await visitor.getByRole("button", { name: "Abrir chamado" }).click();
    await expect(visitor.getByText(/Chamado #\d{4} aberto/).first()).toBeVisible();
    await page.goto("/admin/suporte");
    const ticket = page.locator("li", { hasText: `Placar errado no jogo ${tag}` });
    await expect(ticket).toContainText("Erro em jogo");
    await ticket.getByLabel("Resposta").fill("Corrigido, obrigado!");
    await ticket.getByLabel("Situação").selectOption("RESOLVED");
    await ticket.getByRole("button", { name: "Salvar" }).click();
    await expect(ticket.getByText("Corrigido, obrigado!")).toBeVisible();
    await expect(ticket).toContainText("Resolvido");

    // --- Indicações: torcedores indicam, admin escolhe 3 finalistas
    await page.goto("/admin/indicacoes");
    await page.getByRole("button", { name: "Nova indicação" }).click();
    await page.getByLabel("Título").fill(`Craque ${tag}`);
    await page.getByRole("button", { name: "Abrir indicações" }).click();
    await expect(page.getByText("Indicações abertas.").first()).toBeVisible();

    for (let i = 1; i <= 3; i++) {
      const f = await fan(browser, baseURL!, tag, i);
      await f.page.goto("/indicacoes");
      const poll = f.page.locator("section", { hasText: `Craque ${tag}` });
      const opts = await poll.getByLabel("Atleta").locator("option").allTextContents();
      await poll.getByLabel("Atleta").selectOption({ index: i }); // 3 atletas diferentes
      await poll.getByRole("button", { name: "Indicar atleta" }).click();
      // o formulário dá lugar à confirmação (uma indicação por conta)
      await expect(f.page.locator("section", { hasText: `Craque ${tag}` }).getByText("Sua indicação:")).toBeVisible();
      expect(opts.length).toBeGreaterThan(3);
      await f.page.reload();
      await expect(f.page.locator("section", { hasText: `Craque ${tag}` }).getByRole("button", { name: "Indicar atleta" })).toHaveCount(0);
      await f.ctx.close();
    }

    await page.reload();
    const panel = page.locator("section", { hasText: `Craque ${tag}` });
    await panel.getByLabel("Link da votação no Instagram").fill("https://www.instagram.com/contaojogo/");
    await panel.getByRole("button", { name: "Publicar finalistas" }).click();
    await expect(page.getByText("Finalistas definidos e publicados.").first()).toBeVisible();

    await visitor.goto("/indicacoes");
    const pub = visitor.locator("section", { hasText: `Craque ${tag}` });
    await expect(pub.getByText("1º")).toBeVisible();
    await expect(pub.getByRole("link", { name: /Votar no Instagram/ })).toHaveAttribute("href", "https://www.instagram.com/contaojogo/");

    // pausa o patrocinador de teste para não poluir o portal de desenvolvimento
    await page.goto("/admin/patrocinadores");
    await page.locator("li", { hasText: `Laticínios ${tag}` }).getByRole("button", { name: "Pausar" }).click();
    await anon.close();
  });
});
