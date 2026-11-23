import Link from "next/link";

export default function Forbidden() {
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 py-20 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-amber">Acesso negado</p>
      <h1 className="text-3xl font-extrabold uppercase">Sem permissão</h1>
      <p className="text-sm text-muted-foreground">Seu perfil não tem acesso a esta área.</p>
      <Link href="/" className="mt-2 text-sm font-semibold text-brand-green hover:underline">Voltar ao início</Link>
    </main>
  );
}
