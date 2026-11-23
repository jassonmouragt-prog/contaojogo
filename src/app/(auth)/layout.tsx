import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="bg-pitch-grid flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center"><Logo /></div>
        <div className="rounded-2xl border bg-card p-6 shadow-2xl shadow-black/40">{children}</div>
      </div>
    </main>
  );
}
