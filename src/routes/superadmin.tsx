import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Building2,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldAlert,
  Calendar,
  RefreshCw,
  Users,
  Loader2,
  LockKeyhole,
  Trash2,
  KeyRound,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useSessionStore } from "@/stores/session-store";
import { useHydrateSession } from "@/hooks/use-session";
import { Toaster } from "@/components/ui/sonner";
import {
  PLATFORM_SUPERADMIN_USER,
  SUPERADMIN_USERNAMES,
  SUPERADMIN_PASSWORDS,
  buildDatabase,
} from "@/mocks/seed";

export const Route = createFileRoute("/superadmin")({
  head: () => ({
    meta: [{ title: "Super Admin — Stationery Management" }],
  }),
  component: SuperAdminPage,
});

interface OrgRecord {
  tenantId: string;
  name: string;
  users: string[];
  plan?: string;
  approved?: boolean;
  expiresAt?: string | null;
}

type PlanKey = "pending" | "trial" | "active" | "suspended";

const PLAN_LABELS: Record<
  PlanKey,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  pending: { label: "Pending", variant: "secondary" },
  trial: { label: "Trial", variant: "outline" },
  active: { label: "Active", variant: "default" },
  suspended: { label: "Suspended", variant: "destructive" },
};

function PlanBadge({ plan }: { plan?: string }) {
  const p = (plan as PlanKey) || "pending";
  const cfg = PLAN_LABELS[p] ?? { label: p, variant: "outline" };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

async function fetchOrgs(): Promise<OrgRecord[]> {
  try {
    const res = await fetch(`/api/superadmin/orgs?_t=${Date.now()}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { ok: boolean; orgs: OrgRecord[] };
    return data.orgs || [];
  } catch {
    return [];
  }
}

async function updateOrg(
  tenantId: string,
  patch: { plan?: string; approved?: boolean; expiresAt?: string | null }
): Promise<boolean> {
  try {
    const res = await fetch("/api/superadmin/orgs/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId, ...patch }),
    });
    const data = (await res.json()) as { ok: boolean };
    return data.ok;
  } catch {
    return false;
  }
}

async function cleanCloudDatabase(tenantId: string): Promise<boolean> {
  try {
    const cleanData = buildDatabase();
    const res = await fetch("/api/superadmin/clean-db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId, cleanData }),
    });
    const data = (await res.json()) as { ok: boolean };
    return data.ok;
  } catch {
    return false;
  }
}

function SuperAdminPage() {
  useHydrateSession();
  const user = useSessionStore((s) => s.user);
  const hydrated = useSessionStore((s) => s.hydrated);
  const signIn = useSessionStore((s) => s.signIn);
  const signOut = useSessionStore((s) => s.signOut);

  // Dedicated Superadmin login state
  const [loginUsername, setLoginUsername] = useState("admin");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Console state
  const [orgs, setOrgs] = useState<OrgRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cleaningDb, setCleaningDb] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<OrgRecord | null>(null);
  const [editPlan, setEditPlan] = useState<string>("active");
  const [editExpiry, setEditExpiry] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const isSuperadmin = hydrated && user?.role === "superadmin";

  const load = async () => {
    setLoading(true);
    const data = await fetchOrgs();
    setOrgs(data);
    setLoading(false);
  };

  const refresh = async () => {
    setRefreshing(true);
    const data = await fetchOrgs();
    setOrgs(data);
    setRefreshing(false);
  };

  useEffect(() => {
    if (isSuperadmin) {
      void load();
    }
  }, [isSuperadmin]);

  const handleSuperadminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsSubmitting(true);

    const cleanUser = loginUsername.trim().toLowerCase();
    const cleanPass = loginPassword.trim();

    const usernameValid = SUPERADMIN_USERNAMES.some((u) => u.toLowerCase() === cleanUser);
    const passwordValid = SUPERADMIN_PASSWORDS.includes(cleanPass);

    if (usernameValid && passwordValid) {
      signIn(PLATFORM_SUPERADMIN_USER);
      toast.success("Logged in as Super Admin");
      setIsSubmitting(false);
    } else {
      setLoginError("Invalid superadmin credentials. Use username: admin, password: admin (or admin1234)");
      setIsSubmitting(false);
    }
  };

  const openEdit = (org: OrgRecord) => {
    setSelectedOrg(org);
    setEditPlan(org.plan || "pending");
    setEditExpiry(org.expiresAt ? org.expiresAt.substring(0, 10) : "");
  };

  const saveChanges = async () => {
    if (!selectedOrg) return;
    setSaving(true);
    const expiresAt = editExpiry ? new Date(editExpiry).toISOString() : null;
    const approved = editPlan === "active" || editPlan === "trial";
    const ok = await updateOrg(selectedOrg.tenantId, {
      plan: editPlan,
      approved,
      expiresAt,
    });
    setSaving(false);
    if (ok) {
      toast.success(`Organization "${selectedOrg.name}" updated.`);
      setOrgs((prev) =>
        prev.map((o) =>
          o.tenantId === selectedOrg.tenantId
            ? { ...o, plan: editPlan, approved, expiresAt }
            : o
        )
      );
      setSelectedOrg(null);
    } else {
      toast.error("Failed to update organization. Check KV connection.");
    }
  };

  const quickApprove = async (org: OrgRecord) => {
    const ok = await updateOrg(org.tenantId, { plan: "active", approved: true });
    if (ok) {
      toast.success(`Approved "${org.name}"`);
      setOrgs((prev) =>
        prev.map((o) => (o.tenantId === org.tenantId ? { ...o, plan: "active", approved: true } : o))
      );
    } else {
      toast.error("Failed to approve. Check KV connection.");
    }
  };

  const quickSuspend = async (org: OrgRecord) => {
    const ok = await updateOrg(org.tenantId, { plan: "suspended", approved: false });
    if (ok) {
      toast.warning(`Suspended "${org.name}"`);
      setOrgs((prev) =>
        prev.map((o) => (o.tenantId === org.tenantId ? { ...o, plan: "suspended", approved: false } : o))
      );
    } else {
      toast.error("Failed to suspend. Check KV connection.");
    }
  };

  const handleWipePreseed = async () => {
    if (
      !confirm(
        "Are you sure you want to completely wipe all pre-seeded demo products from Cloudflare KV for the default organization? All products will be cleared so you can upload your own clean data."
      )
    ) {
      return;
    }

    setCleaningDb(true);
    const ok = await cleanCloudDatabase("tenant-abay");
    setCleaningDb(false);
    if (ok) {
      // Also clear localStorage so this device doesn't hold old cache
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("stationery_mgmt_db_v3_tenant-abay");
      }
      toast.success("Cloud database wiped clean! Zero pre-seeded products now in cloud.");
      void refresh();
    } else {
      toast.error("Failed to clean database in Cloudflare KV.");
    }
  };

  // --------------------------------------------------------------------------
  // Dedicated Superadmin Login Page (NO redirect to /login!)
  // --------------------------------------------------------------------------
  if (!isSuperadmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <Toaster richColors />
        <Card className="w-full max-w-md shadow-lg border-border">
          <CardHeader className="space-y-2 text-center pb-4">
            <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-destructive text-destructive-foreground">
              <ShieldAlert className="size-6" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">
              Super Admin Console
            </CardTitle>
            <CardDescription className="text-sm">
              Enter platform administrator credentials to manage organizations and approvals.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSuperadminLogin}>
            <CardContent className="space-y-4">
              {loginError && (
                <Alert variant="destructive">
                  <LockKeyhole className="size-4" />
                  <AlertTitle>Authentication Failed</AlertTitle>
                  <AlertDescription className="text-xs">{loginError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="superadmin-user">Username</Label>
                <Input
                  id="superadmin-user"
                  type="text"
                  autoComplete="username"
                  placeholder="admin"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="superadmin-pass">Password</Label>
                <Input
                  id="superadmin-pass"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter superadmin password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                />
              </div>

              <div className="rounded-lg bg-muted p-3 text-xs space-y-1 border">
                <p className="font-semibold flex items-center gap-1">
                  <KeyRound className="size-3.5 text-primary" /> Default Superadmin Credentials:
                </p>
                <p className="text-muted-foreground">
                  Username: <strong className="text-foreground">admin</strong> (or <strong className="text-foreground">superadmin</strong>)
                </p>
                <p className="text-muted-foreground">
                  Password: <strong className="text-foreground">admin</strong> (or <strong className="text-foreground">admin1234</strong>)
                </p>
              </div>
            </CardContent>

            <CardFooter className="pt-2">
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" /> Verifying…
                  </>
                ) : (
                  "Sign In to Super Admin"
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Superadmin Management Console
  // --------------------------------------------------------------------------
  const pending = orgs.filter((o) => o.plan === "pending" || !o.plan);
  const active = orgs.filter((o) => o.plan === "active");
  const other = orgs.filter((o) => o.plan === "trial" || o.plan === "suspended");

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors />

      {/* Header */}
      <header className="border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-md bg-destructive text-destructive-foreground font-bold text-lg">
              S
            </div>
            <div>
              <p className="font-semibold text-sm">Stationery Management</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <ShieldAlert className="size-3" /> Super Admin Console
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleWipePreseed}
              disabled={cleaningDb}
            >
              {cleaningDb ? (
                <Loader2 className="size-3.5 animate-spin mr-1" />
              ) : (
                <Trash2 className="size-3.5 mr-1" />
              )}
              Wipe Pre-seed Cloud Data
            </Button>
            <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing}>
              {refreshing ? (
                <Loader2 className="size-3.5 animate-spin mr-1" />
              ) : (
                <RefreshCw className="size-3.5 mr-1" />
              )}
              Refresh
            </Button>
            <Button variant="ghost" size="sm" onClick={() => signOut()}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Info Banner */}
        <Alert className="bg-primary/5 border-primary/20">
          <ShieldAlert className="size-4 text-primary" />
          <AlertTitle className="text-sm font-semibold">
            Platform Master Access Active
          </AlertTitle>
          <AlertDescription className="text-xs text-muted-foreground">
            You are managing all registered tenant organizations. Newly registered accounts start in{" "}
            <strong>Pending</strong> mode and cannot log in until you approve them below. You can also
            restrict access (suspend) or set a subscription duration (access expiry date).
          </AlertDescription>
        </Alert>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Orgs", value: orgs.length, icon: Building2 },
            { label: "Pending Approval", value: pending.length, icon: Clock },
            { label: "Active", value: active.length, icon: CheckCircle2 },
            { label: "Suspended / Other", value: other.length, icon: XCircle },
          ].map(({ label, value, icon: Icon }) => (
            <Card key={label}>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5 text-xs">
                  <Icon className="size-3.5" /> {label}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Pending approvals */}
        {pending.length > 0 && (
          <div>
            <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
              <Clock className="size-4 text-amber-500" /> Pending Approval
              <Badge variant="secondary">{pending.length}</Badge>
            </h2>
            <div className="space-y-2">
              {pending.map((org) => (
                <OrgRow
                  key={org.tenantId}
                  org={org}
                  onApprove={() => quickApprove(org)}
                  onSuspend={() => quickSuspend(org)}
                  onEdit={() => openEdit(org)}
                />
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* All organizations */}
        <div>
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            <Building2 className="size-4" /> All Organizations
          </h2>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
              <Loader2 className="size-4 animate-spin" /> Loading organizations from cloud…
            </div>
          ) : orgs.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <Building2 className="size-8 mx-auto mb-3 opacity-30" />
              <p>No organizations registered yet.</p>
              <p className="text-xs mt-1">
                When users sign up, their organizations appear here for approval.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {orgs.map((org) => (
                <OrgRow
                  key={org.tenantId}
                  org={org}
                  onApprove={() => quickApprove(org)}
                  onSuspend={() => quickSuspend(org)}
                  onEdit={() => openEdit(org)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Edit dialog */}
      <Dialog open={!!selectedOrg} onOpenChange={(open) => !open && setSelectedOrg(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Organization</DialogTitle>
            <DialogDescription>
              {selectedOrg?.name} — {selectedOrg?.tenantId}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Access Plan</Label>
              <Select value={editPlan} onValueChange={setEditPlan}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending (blocked)</SelectItem>
                  <SelectItem value="trial">Trial (active, limited)</SelectItem>
                  <SelectItem value="active">Active (full access)</SelectItem>
                  <SelectItem value="suspended">Suspended (blocked)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Duration of Access (Expiry Date)</Label>
              <Input
                type="date"
                value={editExpiry}
                onChange={(e) => setEditExpiry(e.target.value)}
                placeholder="Leave empty for no expiry"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty for permanent access. After this date passes, login for this organization will be blocked.
              </p>
            </div>
            <div className="space-y-1 rounded-md border border-dashed p-3 bg-muted/30">
              <p className="text-xs font-medium">Users in this org:</p>
              {selectedOrg?.users.map((email) => (
                <p key={email} className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users className="size-3" /> {email}
                </p>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedOrg(null)}>
              Cancel
            </Button>
            <Button onClick={saveChanges} disabled={saving}>
              {saving && <Loader2 className="size-3.5 mr-1 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrgRow({
  org,
  onApprove,
  onSuspend,
  onEdit,
}: {
  org: OrgRecord;
  onApprove: () => void;
  onSuspend: () => void;
  onEdit: () => void;
}) {
  const isPending = org.plan === "pending" || !org.plan;
  const isSuspended = org.plan === "suspended";
  const isExpired = org.expiresAt && new Date(org.expiresAt) < new Date();

  return (
    <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary font-bold text-sm">
          {org.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{org.name}</p>
          <p className="text-xs text-muted-foreground truncate">
            {org.tenantId} · {org.users.length} user(s)
          </p>
          {org.expiresAt && (
            <p
              className={`text-xs flex items-center gap-1 ${
                isExpired ? "text-destructive font-medium" : "text-muted-foreground"
              }`}
            >
              <Calendar className="size-3" />
              Expires {new Date(org.expiresAt).toLocaleDateString()}
              {isExpired && " (EXPIRED)"}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <PlanBadge plan={org.plan} />
        {isPending && (
          <Button size="sm" variant="default" className="h-7 text-xs px-2" onClick={onApprove}>
            <CheckCircle2 className="size-3 mr-1" /> Approve
          </Button>
        )}
        {!isSuspended && !isPending && (
          <Button size="sm" variant="destructive" className="h-7 text-xs px-2" onClick={onSuspend}>
            <XCircle className="size-3 mr-1" /> Suspend
          </Button>
        )}
        {isSuspended && (
          <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={onApprove}>
            <CheckCircle2 className="size-3 mr-1" /> Reinstate
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={onEdit}>
          Manage
        </Button>
      </div>
    </div>
  );
}
