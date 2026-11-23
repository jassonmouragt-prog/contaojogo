import { notFound } from "next/navigation";
import { Suspense } from "react";
import { newsBySlug } from "@/domain/engagement/queries";
import { requestNow } from "@/lib/clock-now";
import { formatDateTime } from "@/lib/datetime";

async function Article({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const now = await requestNow();
  const n = await newsBySlug(slug, new Date(now));
  if (!n) notFound();
  return (
    <article className="mx-auto max-w-2xl space-y-4 px-3 py-6 sm:px-4">
      <p className="text-xs text-muted-foreground">{formatDateTime(n.publishAt)}</p>
      <h1 className="text-4xl font-extrabold leading-tight">{n.title}</h1>
      {n.summary && <p className="text-lg text-muted-foreground">{n.summary}</p>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {n.coverUrl && <img src={n.coverUrl} alt="" className="w-full rounded-xl" />}
      {/* Texto puro com quebras de linha: sem HTML do editor (evita XSS). */}
      <div className="space-y-3 whitespace-pre-line text-base leading-relaxed text-foreground/90">{n.body}</div>
    </article>
  );
}

export default function Page(props: PageProps<"/noticias/[slug]">) {
  return <Suspense fallback={<div className="mx-auto h-60 max-w-2xl animate-pulse rounded-xl bg-card" />}><Article params={props.params} /></Suspense>;
}
