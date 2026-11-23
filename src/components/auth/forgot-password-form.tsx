import Link from "next/link";

/** Sem e-mail transacional: a redefinição é feita por um administrador. */
export function ForgotPasswordForm() {
  return (
    <div className="space-y-3 text-center">
      <h1 className="text-2xl font-extrabold uppercase">Esqueci a senha</h1>
      <p className="text-sm text-muted-foreground">
        Peça a um administrador do Conta o Jogo para redefinir sua senha. Depois de entrar,
        você pode trocá-la em <strong className="text-foreground">Minha conta</strong>.
      </p>
      <Link href="/entrar" className="text-sm font-semibold text-brand-green hover:underline">Voltar para entrar</Link>
    </div>
  );
}
