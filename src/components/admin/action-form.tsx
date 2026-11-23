"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useLayoutEffect, useRef } from "react";
import { toast } from "sonner";
import { useCloseCreate } from "@/components/admin/create-panel";
import type { ActionResult } from "@/domain/users/actions";
import { cn } from "@/lib/utils";

/**
 * Formulário com server action.
 * - mostra o resultado como notificação (toast) e também abaixo do botão;
 * - `resetOnSuccess`: limpa os campos (e imagens anexadas) após salvar;
 * - `redirectTo`: navega após sucesso usando o id retornado (":id");
 * - `onSuccess`: callback (ex.: fechar o painel de cadastro).
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  redirectTo,
  onSuccess,
  quiet = false,
  compact = false,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  children: (pending: boolean) => React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  redirectTo?: string;
  onSuccess?: (result: NonNullable<ActionResult>) => void;
  /** Sem notificação (botões pequenos de lista). */
  quiet?: boolean;
  /** Só notificação, sem texto abaixo (botões em linha). */
  compact?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const handled = useRef<ActionResult>(null);
  const closePanel = useCloseCreate();

  useLayoutEffect(() => {
    // Cada resposta é tratada uma única vez (o efeito re-executa em refresh da rota).
    if (!state || handled.current === state) return;
    handled.current = state;
    if (!quiet || !state.ok) (state.ok ? toast.success : toast.error)(state.message);
    if (!state.ok) return;
    if (resetOnSuccess) { ref.current?.reset(); if (!redirectTo) closePanel(); }
    onSuccess?.(state);
    if (redirectTo && state.id) router.push(redirectTo.replace(":id", state.id));
  }, [state, resetOnSuccess, redirectTo, router, onSuccess, quiet, closePanel]);

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
      {state && !quiet && !compact && (
        <p role="status" className={cn("mt-2 text-xs", state.ok ? "text-brand-green" : "text-destructive")}>
          {state.message}
        </p>
      )}
    </form>
  );
}
