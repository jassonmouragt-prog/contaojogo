import { cn } from "@/lib/utils";

const tones = {
  green: "text-brand-green",
  amber: "text-brand-amber",
  blue: "text-brand-blue",
} as const;

export function ClockCard({
  label,
  value,
  tone = "green",
  className,
}: {
  label: string;
  value: string;
  tone?: keyof typeof tones;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border bg-card p-4", className)}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("tabular mt-1 font-mono text-3xl font-bold", tones[tone])}>{value}</p>
    </div>
  );
}
