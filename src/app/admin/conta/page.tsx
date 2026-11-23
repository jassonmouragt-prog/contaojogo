import { eq } from "drizzle-orm";
import { Suspense } from "react";
import { ChangePasswordForm } from "@/components/admin/change-password-form";
import { PageHeader } from "@/components/admin/page-header";
import { TwoFactorSettings } from "@/components/admin/two-factor-settings";
import { getDb } from "@/db";
import { user } from "@/db/schema";
import { requirePermission } from "@/lib/auth/session";

export const metadata = { title: "Minha conta" };

async function Account() {
  const me = await requirePermission("admin.access", "/admin/conta");
  const [row] = await getDb().select({ twoFactorEnabled: user.twoFactorEnabled }).from(user).where(eq(user.id, me.id)).limit(1);
  return (
    <div className="grid max-w-3xl gap-4">
      <p className="text-sm text-muted-foreground">{me.name} • {me.email}</p>
      <ChangePasswordForm />
      <TwoFactorSettings enabled={row?.twoFactorEnabled ?? false} />
    </div>
  );
}

export default function Page() {
  return (
    <>
      <PageHeader title="Minha conta" description="Senha e segurança do acesso." />
      <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-card" />}>
        <Account />
      </Suspense>
    </>
  );
}
