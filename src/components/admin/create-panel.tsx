"use client";

import { Plus, X } from "lucide-react";
import { createContext, useContext, useState } from "react";

const Ctx = createContext<() => void>(() => {});

/** Fecha o painel de cadastro (usado pelos formulários após salvar). */
export function useCloseCreate() {
  return useContext(Ctx);
}

/**
 * Botão "+ Novo …" que abre o formulário de cadastro num cartão.
 * Ao salvar, o formulário é limpo e o painel fecha; a lista abaixo já mostra o novo item.
 */
export function CreatePanel({ label, title, children, defaultOpen = false }: { label: string; title?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-amber px-4 text-sm font-bold text-black shadow-[0_8px_24px_-12px_var(--brand-amber)] transition-transform hover:scale-[1.02]">
        <Plus className="size-4" /> {label}
      </button>
    );
  }
  return (
    <section className="overflow-hidden rounded-2xl border border-brand-amber/40 bg-card shadow-xl shadow-black/30 animate-in fade-in slide-in-from-top-2">
      <div className="flex items-center justify-between border-b bg-brand-amber/10 px-5 py-3">
        <h2 className="text-sm font-bold">{title ?? label}</h2>
        <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="rounded-md p-1 text-muted-foreground hover:bg-background hover:text-foreground"><X className="size-4" /></button>
      </div>
      <div className="p-5"><Ctx.Provider value={() => setOpen(false)}>{children}</Ctx.Provider></div>
    </section>
  );
}
