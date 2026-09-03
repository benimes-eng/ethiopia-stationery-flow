import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useSessionStore, permissionsOf } from "@/stores/session-store";
import { ROLES } from "@/domain/permissions";
import type { Permission } from "@/domain/types";

export function useSession() {
  const user = useSessionStore((s) => s.user);
  const branchId = useSessionStore((s) => s.branchId);
  const hydrated = useSessionStore((s) => s.hydrated);
  const permissions = permissionsOf(user);
  return {
    user,
    branchId,
    hydrated,
    role: user ? ROLES[user.role] : null,
    permissions,
    can: (permission: Permission) => permissions.includes(permission),
  };
}

/**
 * Client-side route guard used by the authenticated shell.
 * Real authorization must also be enforced server-side.
 */
export function useAuthGuard() {
  const navigate = useNavigate();
  const { user, hydrated } = useSession();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!hydrated) return;
    if (!user) navigate({ to: "/login", search: { redirect: pathname }, replace: true });
  }, [hydrated, user, navigate, pathname]);

  return { user, hydrated };
}

export function useHydrateSession() {
  const hydrate = useSessionStore((s) => s.hydrate);
  const hydrated = useSessionStore((s) => s.hydrated);
  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrate, hydrated]);
  return hydrated;
}
