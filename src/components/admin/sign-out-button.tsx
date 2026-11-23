"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { authClient } from "@/lib/auth/client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await authClient.signOut();
          router.replace("/entrar");
          router.refresh();
        })
      }
      className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
    >
      {pending ? "Saindo…" : "Sair"}
    </button>
  );
}
