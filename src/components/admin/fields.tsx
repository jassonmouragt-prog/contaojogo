"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

const control = "h-10 w-full rounded-lg border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring";

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
      <input id={id} name={name} className={control} {...props} />
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
    <button disabled={pending} className="h-10 rounded-lg bg-brand-amber px-4 text-sm font-bold text-black transition-opacity disabled:opacity-50">
      {pending ? "Salvando…" : children}
    </button>
  );
}

export function Panel({ title, children, className, action }: { title: string; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <section className={cn("overflow-hidden rounded-xl border bg-card", className)}>
      <div className="flex items-center justify-between gap-2 bg-surface-2 px-4 py-2">
        <h2 className="text-xs font-bold uppercase tracking-wide">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
