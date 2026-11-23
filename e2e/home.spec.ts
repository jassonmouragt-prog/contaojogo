import { expect, test } from "@playwright/test";

test("página inicial exibe identidade e estado vazio real", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Conta o Jogo/);
  await expect(page.getByRole("link", { name: /página inicial/i })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Jogos");
  await page.getByRole("tab", { name: "Ao vivo" }).click();
  await expect(page.getByText("Nenhuma partida ao vivo agora.")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Hoje" })).toBeVisible();
});

test("health check responde JSON com estado do banco", async ({ request }) => {
  const res = await request.get("/api/health");
  expect([200, 503]).toContain(res.status());
  const body = await res.json();
  expect(body).toHaveProperty("database");
});

test("catálogo de design não existe em produção", async ({ request }) => {
  const res = await request.get("/design");
  expect(res.status()).toBe(404);
});
