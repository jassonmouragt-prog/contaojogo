import { describe, expect, it } from "vitest";
import { can, checkBanChange, checkRoleChange, hasRole, safeNextPath } from "@/lib/auth/permissions";

const base = { actorId: "a", targetId: "t", ownerCount: 2 };

describe("perfis e permissões", () => {
  it("respeita a hierarquia", () => {
    expect(hasRole("OWNER", "ADMIN")).toBe(true);
    expect(hasRole("OPERATOR", "ADMIN")).toBe(false);
    expect(hasRole(null, "USER")).toBe(false);
    expect(can("OPERATOR", "match.operate")).toBe(true);
    expect(can("OPERATOR", "match.confirm")).toBe(false);
    expect(can("ADMIN", "match.confirm")).toBe(true);
    expect(can("ADMIN", "settings.manage")).toBe(false);
    expect(can("USER", "admin.access")).toBe(false);
  });

  it("ninguém altera o próprio perfil", () => {
    expect(checkRoleChange({ ...base, targetId: "a", actorRole: "OWNER", targetRole: "OWNER", newRole: "ADMIN" })).toBe("self");
  });

  it("ADMIN gerencia apenas operadores e usuários", () => {
    expect(checkRoleChange({ ...base, actorRole: "ADMIN", targetRole: "USER", newRole: "OPERATOR" })).toBeNull();
    expect(checkRoleChange({ ...base, actorRole: "ADMIN", targetRole: "USER", newRole: "ADMIN" })).toBe("insufficient_role");
    expect(checkRoleChange({ ...base, actorRole: "ADMIN", targetRole: "ADMIN", newRole: "USER" })).toBe("target_outranks");
    expect(checkRoleChange({ ...base, actorRole: "ADMIN", targetRole: "OWNER", newRole: "USER" })).toBe("target_outranks");
  });

  it("OPERATOR e USER não gerenciam ninguém", () => {
    expect(checkRoleChange({ ...base, actorRole: "OPERATOR", targetRole: "USER", newRole: "OPERATOR" })).toBe("insufficient_role");
  });

  it("OWNER gerencia todos mas nunca remove o último proprietário", () => {
    expect(checkRoleChange({ ...base, actorRole: "OWNER", targetRole: "ADMIN", newRole: "OWNER" })).toBeNull();
    expect(checkRoleChange({ ...base, actorRole: "OWNER", targetRole: "OWNER", newRole: "ADMIN" })).toBeNull();
    expect(checkRoleChange({ ...base, ownerCount: 1, actorRole: "OWNER", targetRole: "OWNER", newRole: "ADMIN" })).toBe("last_owner");
  });

  it("bloqueio segue a hierarquia e protege proprietários", () => {
    expect(checkBanChange({ actorId: "a", targetId: "t", actorRole: "ADMIN", targetRole: "OPERATOR" })).toBeNull();
    expect(checkBanChange({ actorId: "a", targetId: "t", actorRole: "ADMIN", targetRole: "ADMIN" })).toBe("target_outranks");
    expect(checkBanChange({ actorId: "a", targetId: "t", actorRole: "OWNER", targetRole: "OWNER" })).toBe("target_outranks");
    expect(checkBanChange({ actorId: "a", targetId: "a", actorRole: "OWNER", targetRole: "OWNER" })).toBe("self");
  });

  it("bloqueia redirecionamento externo", () => {
    expect(safeNextPath("/admin/usuarios")).toBe("/admin/usuarios");
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(safeNextPath("/\\evil.com")).toBe("/");
    expect(safeNextPath(undefined, "/admin")).toBe("/admin");
  });
});
