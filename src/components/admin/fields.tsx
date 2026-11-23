"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

const PICKER_TYPES = new Set(["date", "datetime-local", "time"]);
const control = "h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm transition-colors placeholder:text-muted-foreground/60 hover:border-foreground/20 focus-visible:border-brand-amber focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-amber/30";

export function Field({ label, htmlFor, children, className, hint }: { label: string; htmlFor: string; children: React.ReactNode; className?: string; hint?: string }) {
  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor={htmlFor} className="text-xs font-semibold text-muted-foreground">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function TextInput({ label, name, className, hint, ...props }: { label: string; name: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = `${name}-${useId()}`;
  return (
    <Field label={label} htmlFor={id} className={className} hint={hint}>
      <input
        id={id}
        name={name}
        className={cn(control, PICKER_TYPES.has(String(props.type)) && "cursor-pointer [color-scheme:dark]")}
        {...props}
        // Data/hora: abre o calendário ao clicar em qualquer parte do campo, não só no ícone.
        onClick={(e) => {
          props.onClick?.(e);
          if (PICKER_TYPES.has(String(props.type))) {
            try { e.currentTarget.showPicker?.(); } catch { /* navegador sem suporte */ }
          }
        }}
      />
    </Field>
  );
}

export function SelectInput({ label, name, options, className, placeholder, ...props }: { label: string; name: string; options: { value: string; label: string }[]; placeholder?: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const id = `${name}-${useId()}`;
  return (
    <Field label={label} htmlFor={id} className={className}>
      <select id={id} name={name} className={control} {...props}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </Field>
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button disabled={pending} className="h-11 rounded-xl bg-brand-amber px-5 text-sm font-bold text-black transition-all hover:brightness-110 disabled:opacity-50">
      {pending ? "Salvando…" : children}
    </button>
  );
}

export function Panel({ title, children, className, action }: { title: string; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <section className={cn("overflow-hidden rounded-2xl border bg-card", className)}>
      <div className="flex items-center justify-between gap-2 border-b px-5 py-3">
        <h2 className="text-sm font-bold">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}
