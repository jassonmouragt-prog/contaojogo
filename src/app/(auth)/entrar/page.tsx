import { Suspense } from "react";
import { SignInForm } from "@/components/auth/sign-in-form";
import { safeNextPath } from "@/lib/auth/permissions";

export const metadata = { title: "Entrar" };

async function Form({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <SignInForm next={safeNextPath(next, "/admin")} />;
}

export default function Page(props: PageProps<"/entrar">) {
  return (
    <Suspense>
      <Form searchParams={props.searchParams as Promise<{ next?: string }>} />
    </Suspense>
  );
}
