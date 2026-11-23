import { activeSponsors } from "@/domain/engagement/queries";
import { requestNow } from "@/lib/clock-now";
import { SponsorCarousel } from "./sponsor-carousel";

/** Busca os patrocinadores da posição; sem cadastro, não ocupa espaço. */
export async function SponsorSlot({ placement, className }: { placement: "HOME" | "COMPETITION" | "MATCH"; className?: string }) {
  const now = await requestNow();
  const items = await activeSponsors(placement, new Date(now));
  if (items.length === 0) return null;
  return <div className={className}><SponsorCarousel items={items} placement={placement} /></div>;
}
