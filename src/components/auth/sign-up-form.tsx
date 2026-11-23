"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";
import { FormError, FormField } from "./form-field";

export function SignUpForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password"));
    if (password.length < 8) return setError("A senha precisa ter pelo menos 8 caracteres.");
    if (password !== String(fd.get("confirm"))) return setError("As senhas não conferem.");
    setPending(true);
    setError(null);
    const { error } = await authClient.signUp.email({
      name: String(fd.get("name")).trim(),
      email: String(fd.get("email")).trim(),
      password,
    });
    setPending(false);
    if (error) {
      setError(error.code === "USER_ALREADY_EXISTS" || error.status === 422 ? "Este e-mail já tem cadastro." : "Não foi possível criar a conta.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <h1 className="text-2xl font-extrabold uppercase">Criar conta</h1>
        <p className="text-sm text-muted-foreground">Participe das indicações e acompanhe seus times.</p>
      </div>
      <FormField id="name" label="Nome" autoComplete="name" required minLength={2} />
      <FormField id="email" label="E-mail" type="email" autoComplete="email" required />
      <FormField id="password" label="Senha" type="password" autoComplete="new-password" required minLength={8} />
      <FormField id="confirm" label="Confirmar senha" type="password" autoComplete="new-password" required />
      <FormError message={error} />
      <Button type="submit" className="h-10 w-full font-bold" disabled={pending}>
        {pending ? "Criando…" : "Criar conta"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Já tem conta? <Link href="/entrar" className="font-semibold text-brand-green hover:underline">Entrar</Link>
      </p>
    </form>
  );
}
