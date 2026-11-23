import type { Role } from "@/db/schema/enums";

/** Hierarquia: OWNER > ADMIN > OPERATOR > USER. */
export const ROLE_RANK: Record<Role, number> = { OWNER: 3, ADMIN: 2, OPERATOR: 1, USER: 0 };

export const ROLE_LABEL: Record<Role, string> = {
  OWNER: "Proprietário",
  ADMIN: "Administrador",
  OPERATOR: "Operador",
  USER: "Usuário",
};

export const PERMISSIONS = {
  "admin.access": "OPERATOR",
  "dashboard.view": "OPERATOR",
  "match.operate": "OPERATOR",
  "match.confirm": "ADMIN",
  "competition.manage": "ADMIN",
  "content.manage": "ADMIN",
  "users.view": "ADMIN",
  "users.manage": "ADMIN",
  "audit.view": "ADMIN",
  "settings.manage": "OWNER",
} as const satisfies Record<string, Role>;

export type Permission = keyof typeof PERMISSIONS;

export function hasRole(role: Role | null | undefined, minimum: Role): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export function can(role: Role | null | undefined, permission: Permission): boolean {
  return hasRole(role, PERMISSIONS[permission]);
}

export type RoleChangeDenial =
  | "self"
  | "insufficient_role"
  | "target_outranks"
  | "last_owner";

/**
 * Regras para alterar o perfil de outra pessoa:
 * - ninguém altera o próprio perfil;
 * - ADMIN só gerencia OPERATOR/USER e só atribui OPERATOR/USER;
 * - OWNER gerencia todos, inclusive promover outro OWNER;
 * - o último OWNER nunca é rebaixado (o proprietário mantém controle).
 */
export function checkRoleChange(input: {
  actorId: string;
  actorRole: Role;
  targetId: string;
  targetRole: Role;
  newRole: Role;
  ownerCount: number;
}): RoleChangeDenial | null {
  const { actorId, actorRole, targetId, targetRole, newRole, ownerCount } = input;
  if (actorId === targetId) return "self";
  if (!can(actorRole, "users.manage")) return "insufficient_role";
  if (actorRole !== "OWNER") {
    if (ROLE_RANK[targetRole] >= ROLE_RANK.ADMIN) return "target_outranks";
    if (ROLE_RANK[newRole] >= ROLE_RANK.ADMIN) return "insufficient_role";
  }
  if (targetRole === "OWNER" && newRole !== "OWNER" && ownerCount <= 1) return "last_owner";
  return null;
}

/** Bloquear/desbloquear segue a mesma hierarquia (sem o caso de troca de perfil). */
export function checkBanChange(input: {
  actorId: string;
  actorRole: Role;
  targetId: string;
  targetRole: Role;
}): RoleChangeDenial | null {
  if (input.actorId === input.targetId) return "self";
  if (!can(input.actorRole, "users.manage")) return "insufficient_role";
  if (input.targetRole === "OWNER") return "target_outranks";
  if (input.actorRole !== "OWNER" && ROLE_RANK[input.targetRole] >= ROLE_RANK.ADMIN)
    return "target_outranks";
  return null;
}

export const DENIAL_MESSAGE: Record<RoleChangeDenial, string> = {
  self: "Você não pode alterar a sua própria conta por aqui.",
  insufficient_role: "Seu perfil não permite esta alteração.",
  target_outranks: "Este usuário tem perfil igual ou superior ao seu.",
  last_owner: "É preciso manter pelo menos um proprietário.",
};

/** Garante que `next` é um caminho interno (evita open redirect). */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
