import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const pill = cva(
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider",
  {
    variants: {
      tone: {
        live: "bg-brand-live text-white",
        finished: "bg-white/10 text-foreground",
        scheduled: "bg-brand-green/15 text-brand-green",
        public: "bg-brand-green text-primary-foreground",
        admin: "bg-brand-amber text-black",
      },
    },
    defaultVariants: { tone: "scheduled" },
  },
);

export type StatusPillProps = VariantProps<typeof pill> & {
  children: React.ReactNode;
  className?: string;
};

export function StatusPill({ tone, children, className }: StatusPillProps) {
  return (
    <span className={cn(pill({ tone }), className)}>
      {tone === "live" && (
        <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-white" />
      )}
      {children}
    </span>
  );
}
