import { expect, test } from "@playwright/test";

test("área admin exige login e preserva o destino", async ({ request }) => {
  const res = await request.get("/admin/usuarios", { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(res.headers()["location"]).toContain("/entrar?next=%2Fadmin%2Fusuarios");
});

test("tela de login renderiza", async ({ page }) => {
  await page.goto("/entrar");
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  await expect(page.getByLabel("E-mail")).toBeVisible();
});

/**
 * Fluxo completo contra o banco de desenvolvimento. Requer
 * E2E_OWNER_EMAIL/E2E_OWNER_PASSWORD (conta criada com npm run owner:create).
 */
test.describe("com proprietário de teste", () => {
  test.skip(!process.env.E2E_OWNER_EMAIL, "E2E_OWNER_EMAIL não definido");
  // Login tem rate limit (proteção contra força bruta): roda em um único projeto.
  test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "somente desktop"));

  test("proprietário entra e vê o painel; senha errada é recusada", async ({ request }) => {
    const bad = await request.post("/api/auth/sign-in/email", {
      data: { email: process.env.E2E_OWNER_EMAIL, password: "senha-errada-123" },
      headers: { origin: test.info().project.use.baseURL! },
    });
    expect(bad.status()).toBe(401);

    const ok = await request.post("/api/auth/sign-in/email", {
      data: { email: process.env.E2E_OWNER_EMAIL, password: process.env.E2E_OWNER_PASSWORD },
      headers: { origin: test.info().project.use.baseURL! },
    });
    expect(ok.status()).toBe(200);

    for (const path of ["/admin", "/admin/usuarios", "/admin/auditoria", "/admin/configuracoes"]) {
      const page = await request.get(path);
      expect(page.status(), path).toBe(200);
    }
    const users = await (await request.get("/admin/usuarios")).text();
    expect(users).toContain(process.env.E2E_OWNER_EMAIL!);

    const exp = await request.get("/api/admin/export");
    expect(exp.status()).toBe(200);
    const data = await exp.json();
    expect(data.users.some((u: { email: string }) => u.email === process.env.E2E_OWNER_EMAIL)).toBe(true);
    // nenhum campo de senha/sessão/token no arquivo
    expect(JSON.stringify(data)).not.toMatch(/"(password|token|accessToken|refreshToken|secret)":/);
  });

  test("usuário comum não acessa o admin e não escala perfil no cadastro", async ({ request }) => {
    const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@teste.contaojogo.club`;
    const origin = test.info().project.use.baseURL!;
    const res = await request.post("/api/auth/sign-up/email", {
      data: { name: "Torcedor E2E", email, password: "senha-forte-123", role: "OWNER" },
      headers: { origin },
    });
    expect(res.status()).toBe(200);
    // Com streaming (PPR) o status HTTP já foi enviado; o conteúdo protegido não pode aparecer.
    for (const path of ["/admin", "/admin/usuarios"]) {
      const html = await (await request.get(path)).text();
      expect(html, path).toContain("Sem permissão");
      expect(html, path).not.toContain("e2e-owner@teste.contaojogo.club");
      expect(html, path).not.toContain("Resumo operacional");
    }
  });
});

test("cabeçalhos de segurança e exportação restrita", async ({ request }) => {
  const home = await request.get("/");
  const h = home.headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-powered-by"]).toBeUndefined();
  const exp = await request.get("/api/admin/export");
  expect(exp.status()).toBe(403);
});
