"use client";

import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useState } from "react";
import { FormError, FormField } from "@/components/auth/form-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

type Setup = { qr: string; secret: string; backupCodes: string[] };

export function TwoFactorSettings({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function start(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password"));
    setPending(true);
    setError(null);
    const { data, error } = await authClient.twoFactor.enable({ password });
    setPending(false);
    if (error || !data) return setError("Senha incorreta.");
    if (data.method !== "totp") return setError("Método de verificação não suportado.");
    const secret = new URL(data.totpURI).searchParams.get("secret") ?? "";
    setSetup({ qr: await QRCode.toDataURL(data.totpURI, { margin: 1, width: 200 }), secret, backupCodes: data.backupCodes });
  }

  async function confirm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = String(new FormData(e.currentTarget).get("code")).replace(/\s/g, "");
    setPending(true);
    setError(null);
    const { error } = await authClient.twoFactor.verifyTotp({ code });
    setPending(false);
    if (error) return setError("Código inválido. Confira o horário do celular e tente de novo.");
    setSetup(null);
    router.refresh();
  }

  async function disable(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password"));
    setPending(true);
    setError(null);
    const { error } = await authClient.twoFactor.disable({ password });
    setPending(false);
    if (error) return setError("Senha incorreta.");
    router.refresh();
  }

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Verificação em duas etapas</h2>
        <span className={enabled ? "text-xs font-bold text-brand-green" : "text-xs font-bold text-muted-foreground"}>
          {enabled ? "ATIVA" : "DESATIVADA"}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        Além da senha, o login pede um código do Google Authenticator, Microsoft Authenticator ou similar.
      </p>

      {enabled ? (
        <form onSubmit={disable} className="space-y-3" noValidate>
          <FormField id="password" label="Confirme sua senha para desativar" type="password" autoComplete="current-password" required />
          <FormError message={error} />
          <Button type="submit" variant="destructive" disabled={pending}>Desativar</Button>
        </form>
      ) : setup ? (
        <div className="space-y-4">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Escaneie o QR code no app autenticador.</li>
            <li>Guarde os códigos de backup em local seguro — cada um vale uma vez.</li>
            <li>Digite o código de 6 dígitos para concluir.</li>
          </ol>
          <div className="flex flex-wrap items-start gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setup.qr} alt="QR code para o app autenticador" width={200} height={200} className="rounded-lg bg-white p-1" />
            <div className="min-w-0 space-y-2">
              <p className="text-xs text-muted-foreground">Chave manual</p>
              <p className="break-all font-mono text-sm">{setup.secret}</p>
              <p className="pt-2 text-xs text-muted-foreground">Códigos de backup</p>
              <ul className="grid grid-cols-2 gap-x-4 font-mono text-sm">
                {setup.backupCodes.map((c) => <li key={c}>{c}</li>)}
              </ul>
            </div>
          </div>
          <form onSubmit={confirm} className="space-y-3" noValidate>
            <FormField id="code" label="Código do app" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required />
            <FormError message={error} />
            <Button type="submit" disabled={pending} className="bg-brand-amber font-bold text-black hover:bg-brand-amber/85">Concluir ativação</Button>
          </form>
        </div>
      ) : (
        <form onSubmit={start} className="space-y-3" noValidate>
          <FormField id="password" label="Confirme sua senha" type="password" autoComplete="current-password" required />
          <FormError message={error} />
          <Button type="submit" disabled={pending} className="bg-brand-amber font-bold text-black hover:bg-brand-amber/85">Ativar</Button>
        </form>
      )}
    </section>
  );
}
