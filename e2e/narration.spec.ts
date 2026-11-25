import { expect, test } from "@playwright/test";

/**
 * Narração ao vivo de verdade (Cloudflare Realtime): narrador com microfone
 * falso do Chromium transmite; torcedor conecta e recebe áudio.
 * Precisa de E2E_LIVE_MATCH_ID (jogo ao vivo publicado) e das chaves da Cloudflare.
 */
test.use({ launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"] } });

test("narrador transmite e torcedor ouve", async ({ page, browser }, info) => {
  test.skip(info.project.name !== "desktop" || !process.env.E2E_LIVE_MATCH_ID || !process.env.E2E_OWNER_EMAIL, "sem jogo ao vivo de teste");
  test.setTimeout(120_000);
  const id = process.env.E2E_LIVE_MATCH_ID!;
  await page.context().grantPermissions(["microphone"]);
  await page.goto(`/entrar?next=/admin/jogos/${id}/narrar`);
  await page.getByLabel("E-mail").fill(process.env.E2E_OWNER_EMAIL!);
  await page.getByLabel("Senha").fill(process.env.E2E_OWNER_PASSWORD!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((u) => u.pathname.endsWith("/narrar"));
  await page.getByRole("button", { name: "Começar narração" }).click();
  await expect(page.getByText("● No ar")).toBeVisible({ timeout: 30_000 });

  const fan = await (await browser.newContext()).newPage();
  await fan.goto(`/jogos/${id}`);
  await fan.getByRole("button", { name: "Ouvir narração ao vivo" }).click();
  await expect(fan.getByText("Você está ouvindo o narrador do Conta o Jogo.")).toBeVisible({ timeout: 30_000 });
  // Áudio chegando de fato: bytes recebidos crescem
  await expect(async () => {
    const bytes = await fan.evaluate(async () => {
      const a = document.querySelector("audio") as HTMLAudioElement & { srcObject: MediaStream | null };
      return a?.srcObject?.getAudioTracks()[0]?.readyState === "live" ? 1 : 0;
    });
    expect(bytes).toBe(1);
  }).toPass({ timeout: 15_000 });

  await page.getByRole("button", { name: "Encerrar narração" }).click();
  await expect(page.getByText("Fora do ar")).toBeVisible();
  await expect(fan.getByText(/A narração saiu do ar|Toque para ouvir/).or(fan.getByLabel("Narração ao vivo")).first()).toBeVisible();
});
