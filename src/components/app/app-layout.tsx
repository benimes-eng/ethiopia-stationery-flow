import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useAuthGuard, useHydrateSession, useSession } from "@/hooks/use-session";
import { AppShell } from "./app-shell";
import { PermissionDenied } from "./primitives";
import type { Permission } from "@/domain/types";

/**
 * Authenticated page wrapper. Client-side gating only — server-side
 * authorization must be enforced again once a real API is connected.
 */
export function AppLayout({
  permission,
  children,
}: {
  permission?: Permission;
  children: ReactNode;
}) {
  useHydrateSession();
  const { hydrated, user } = useAuthGuard();
  const { can } = useSession();

  if (!hydrated || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Preparing your workspace…
      </div>
    );
  }

  return (
    <AppShell>
      {permission && !can(permission) ? <PermissionDenied permission={permission} /> : children}
    </AppShell>
  );
}
