import Link from "next/link";
import { Suspense } from "react";
import { publishedNews } from "@/domain/engagement/queries";
import { requestNow } from "@/lib/clock-now";
import { formatDateTime } from "@/lib/datetime";

export const metadata = { title: "Notícias" };

async function List() {
  const now = await requestNow();
  const rows = await publishedNews(new Date(now));
  if (rows.length === 0) return <p className="rounded-xl border border-dashed bg-card/60 p-8 text-center text-sm text-muted-foreground">Nenhuma notícia publicada.</p>;
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {rows.map((n) => (
        <li key={n.id}>
          <Link href={`/noticias/${n.slug}`} className="block h-full overflow-hidden rounded-xl border bg-card hover:border-brand-green/50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {n.coverUrl && <img src={n.coverUrl} alt="" className="aspect-video w-full object-cover" />}
            <div className="p-4">
              <p className="text-[11px] text-muted-foreground">{formatDateTime(n.publishAt)}</p>
              <p className="mt-1 font-display text-xl font-bold leading-tight">{n.title}</p>
              {n.summary && <p className="mt-1 text-sm text-muted-foreground">{n.summary}</p>}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function Page() {
  return (
    <div className="mx-auto max-w-5xl space-y-4 px-3 py-6 sm:px-4">
      <h1 className="text-3xl font-extrabold uppercase">Notícias</h1>
      <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-card" />}><List /></Suspense>
    </div>
  );
}
