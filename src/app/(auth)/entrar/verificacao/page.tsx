import { Suspense } from "react";
import { TwoFactorVerifyForm } from "@/components/auth/two-factor-verify-form";
import { safeNextPath } from "@/lib/auth/permissions";

export const metadata = { title: "Verificação em duas etapas" };

async function Form({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <TwoFactorVerifyForm next={safeNextPath(next, "/admin")} />;
}

export default function Page(props: PageProps<"/entrar/verificacao">) {
  return (
    <Suspense>
      <Form searchParams={props.searchParams as Promise<{ next?: string }>} />
    </Suspense>
  );
}
