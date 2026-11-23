"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";
import { FormError, FormField } from "./form-field";

export function SignInForm({ next }: { next: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    const { data, error } = await authClient.signIn.email({
      email: String(fd.get("email")),
      password: String(fd.get("password")),
    });
    // Com 2FA ativo, o cliente redireciona para /entrar/verificacao.
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) return;
    setPending(false);
    if (error) {
      setError(error.status === 403 ? (error.message ?? "Conta bloqueada.") : "E-mail ou senha incorretos.");
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <h1 className="text-2xl font-extrabold uppercase">Entrar</h1>
        <p className="text-sm text-muted-foreground">Acesse sua conta do Conta o Jogo.</p>
      </div>
      <FormField id="email" label="E-mail" type="email" autoComplete="email" required />
      <FormField id="password" label="Senha" type="password" autoComplete="current-password" required />
      <FormError message={error} />
      <Button type="submit" className="h-10 w-full font-bold" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </Button>
      <div className="flex justify-between text-sm">
        <Link href="/esqueci-senha" className="text-muted-foreground hover:text-foreground">Esqueci a senha</Link>
        <Link href="/cadastro" className="font-semibold text-brand-green hover:underline">Criar conta</Link>
      </div>
    </form>
  );
}
