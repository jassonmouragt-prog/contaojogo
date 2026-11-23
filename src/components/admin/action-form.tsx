"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useLayoutEffect, useRef } from "react";
import type { ActionResult } from "@/domain/users/actions";
import { cn } from "@/lib/utils";

/**
 * Formulário com server action + mensagem acessível.
 * - `resetOnSuccess`: limpa os campos após sucesso (cadastros em sequência).
 * - `redirectTo`: navega após sucesso usando o id retornado.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  redirectTo,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  children: (pending: boolean) => React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  redirectTo?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const handled = useRef<ActionResult>(null);

  // Layout effect: limpa antes da próxima pintura, sem apagar o que a pessoa já começou a digitar.
  useLayoutEffect(() => {
    // Cada resposta é tratada uma única vez (o efeito re-executa em refresh da rota).
    if (!state?.ok || handled.current === state) return;
    handled.current = state;
    if (resetOnSuccess) ref.current?.reset();
    if (redirectTo && state.id) router.push(redirectTo.replace(":id", state.id));
  }, [state, resetOnSuccess, redirectTo, router]);

  return (
    <form
      ref={ref}
      // onSubmit manual: com `action={...}` o React 19 limpa o formulário até em erro.
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
      className={className}
    >
      {children(pending)}
      {state && (
        <p role="status" className={cn("mt-2 text-xs", state.ok ? "text-brand-green" : "text-destructive")}>
          {state.message}
        </p>
      )}
    </form>
  );
}
