import Link from "next/link";

/** Cabeçalho de página do admin: trilha, título, descrição e ação principal. */
export function PageHeader({
  title,
  description,
  back,
  actions,
}: {
  title: string;
  description?: string;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {back && <Link href={back.href} className="mb-1 inline-block text-xs font-semibold text-muted-foreground hover:text-brand-amber">← {back.label}</Link>}
        <h1 className="truncate font-display text-3xl font-extrabold uppercase tracking-tight">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, text, children }: { title: string; text?: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed bg-card/40 px-6 py-10 text-center">
      <p className="font-semibold">{title}</p>
      {text && <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{text}</p>}
      {children && <div className="mt-4 flex justify-center">{children}</div>}
    </div>
  );
}
