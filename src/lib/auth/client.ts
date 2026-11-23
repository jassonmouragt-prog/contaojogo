"use client";

import { twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect() {
        const next = new URLSearchParams(window.location.search).get("next") ?? "/admin";
        // Navegação completa: a sessão parcial de 2FA vive em cookie.
        window.location.assign(new URL(`/entrar/verificacao?next=${encodeURIComponent(next)}`, window.location.origin));
      },
    }),
  ],
});
