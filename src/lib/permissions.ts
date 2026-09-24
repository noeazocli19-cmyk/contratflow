// Permissions helper — client + server shared.
// Roles are stored as strings (OWNER | ADMIN | MEMBER) on the User model.

export type Role = "OWNER" | "ADMIN" | "MEMBER";

export const ROLES: Role[] = ["OWNER", "ADMIN", "MEMBER"];

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Propriétaire",
  ADMIN: "Administrateur",
  MEMBER: "Membre",
};

// Each role grants a fixed list of permissions. "*" means "all".
export const PERMISSIONS: Record<Role, readonly string[]> = {
  OWNER: ["*"],
  ADMIN: [
    "manage_clients",
    "manage_proposals",
    "manage_contracts",
    "manage_projects",
    "manage_invoices",
    "manage_payments",
    "manage_documents",
    "view_reports",
    "manage_team",
    "view_team",
  ],
  MEMBER: [
    "view_clients",
    "manage_assigned_projects",
    "create_proposals",
    "prepare_contracts",
    "view_invoices",
    "create_payments",
    "view_documents",
    "view_reports",
  ],
};

export function isRole(v: unknown): v is Role {
  return v === "OWNER" || v === "ADMIN" || v === "MEMBER";
}

export function can(role: Role | string | undefined, permission: string): boolean {
  if (!role) return false;
  if (role === "OWNER") return true;
  const r = role as Role;
  const perms = PERMISSIONS[r];
  if (!perms) return false;
  return perms.includes("*") || perms.includes(permission);
}

export function canManageTeam(role: Role | string | undefined): boolean {
  return can(role, "manage_team");
}

export function canViewTeam(role: Role | string | undefined): boolean {
  return can(role, "view_team") || can(role, "manage_team");
}
