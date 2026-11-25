import Link from "next/link";

export const metadata = { title: "Assinatura recebida" };
const WHATSAPP = "5588999247743";

export default function Page() {
  const msg = encodeURIComponent("Olá! Acabei de assinar um plano no Conta o Jogo e quero fazer o pagamento.");
  return (
    <div className="mx-auto max-w-lg space-y-4 px-3 py-12 text-center sm:px-4">
      <p className="text-5xl">✅</p>
      <h1 className="text-2xl font-black uppercase">Cadastro recebido!</h1>
      <p className="text-muted-foreground">Sua conta foi criada e a assinatura está aguardando pagamento. Assim que for confirmada, o painel do seu clube ou liga é liberado no mesmo login.</p>
      <a href={`https://wa.me/${WHATSAPP}?text=${msg}`} target="_blank" rel="noopener" className="mx-auto grid h-12 max-w-xs place-items-center rounded-xl bg-[#25D366] font-extrabold text-white">Combinar pagamento no WhatsApp</a>
      <p className="text-xs text-muted-foreground">WhatsApp: +55 88 99924-7743</p>
      <Link href="/" className="inline-block text-sm font-semibold text-brand-green">Voltar ao site</Link>
    </div>
  );
}
