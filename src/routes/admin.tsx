import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Check,
  History,
  KeyRound,
  Plus,
  ShieldCheck,
  Users as UsersIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/app/app-layout";
import {
  DateDisplay,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from "@/components/app/primitives";
import {
  DataTable,
  FilterBar,
  SearchInput,
  type Column,
} from "@/components/app/data-table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSession } from "@/hooks/use-session";
import { catalogService } from "@/services/catalog.service";
import { financeService } from "@/services/finance.service";
import {
  ALL_PERMISSIONS,
  PERMISSION_GROUPS,
  ROLES,
  ROLE_KEYS,
  roleCan,
} from "@/domain/permissions";
import type { AuditLog, Branch, RoleKey, User } from "@/domain/types";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administration — Stationery Management" },
      {
        name: "description",
        content:
          "Manage company branches, users, system roles, permissions matrix and inspect audit trails.",
      },
    ],
  }),
  component: AdminRoute,
});

function AdminRoute() {
  return (
    <AppLayout permission="users.manage">
      <AdminDashboard />
    </AppLayout>
  );
}

function AdminDashboard() {
  const { can } = useSession();
  const [activeTab, setActiveTab] = useState("users");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administration"
        description="Branch locations, user accounts, role definitions and immutable activity audit log."
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:grid-cols-4">
          <TabsTrigger value="users">
            <UsersIcon className="mr-2 size-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="branches">
            <Building2 className="mr-2 size-4" />
            Branches
          </TabsTrigger>
          <TabsTrigger value="roles">
            <KeyRound className="mr-2 size-4" />
            Roles & Access
          </TabsTrigger>
          <TabsTrigger value="audit">
            <History className="mr-2 size-4" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <UsersTab />
        </TabsContent>

        <TabsContent value="branches" className="mt-4">
          <BranchesTab />
        </TabsContent>

        <TabsContent value="roles" className="mt-4">
          <RolesMatrixTab />
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <AuditLogTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ======================== Users Tab ======================== */

const userSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().min(7, "Phone is required"),
  role: z.enum(["owner", "manager", "cashier", "storekeeper", "accountant"]),
  branchId: z.string().min(1, "Branch assignment is required"),
  status: z.enum(["active", "inactive"]),
  password: z.string().optional(),
});
type UserFormData = z.infer<typeof userSchema>;

function UsersTab() {
  const { can } = useSession();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => catalogService.getUsers(),
  });

  const branches = catalogService.branches();

  const filtered = (users.data ?? []).filter((u) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.phone.includes(q)
    );
  });

  const columns: Array<Column<User>> = [
    {
      key: "name",
      header: "User",
      render: (row) => (
        <div>
          <p className="font-medium">{row.name}</p>
          <p className="text-xs text-muted-foreground">{row.email}</p>
        </div>
      ),
      sortValue: (row) => row.name,
    },
    {
      key: "role",
      header: "Role",
      render: (row) => (
        <span className="capitalize font-medium text-sm text-foreground">
          {ROLES[row.role]?.name ?? row.role}
        </span>
      ),
      sortValue: (row) => row.role,
    },
    {
      key: "branch",
      header: "Branch",
      render: (row) => branches.find((b) => b.id === row.branchId)?.name ?? "—",
      hideOnMobile: true,
    },
    {
      key: "phone",
      header: "Phone",
      render: (row) => <span className="num text-sm">{row.phone}</span>,
      hideOnMobile: true,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status} />,
      sortValue: (row) => row.status,
    },
    {
      key: "last_active",
      header: "Last active",
      render: (row) =>
        row.lastActiveAt ? (
          <DateDisplay value={row.lastActiveAt} withTime />
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        ),
      hideOnMobile: true,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          {can("users.manage") && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(row);
                setFormOpen(true);
              }}
            >
              Edit
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-4">
          <StatCard
            label="Total users"
            value={String(users.data?.length ?? 0)}
            loading={users.isLoading}
          />
          <StatCard
            label="Active accounts"
            value={String(users.data?.filter((u) => u.status === "active").length ?? 0)}
            loading={users.isLoading}
          />
        </div>
        {can("users.manage") && (
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-2 size-4" />
            New user
          </Button>
        )}
      </div>

      <SectionCard contentClassName="p-0">
        <FilterBar>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by name, email or phone"
          />
        </FilterBar>
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(row) => row.id}
          loading={users.isLoading}
          error={users.error}
          onRetry={() => void users.refetch()}
          pageSize={10}
          caption="Staff accounts"
        />
      </SectionCard>

      {formOpen && (
        <UserFormModal
          initial={editing}
          branches={branches}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            void qc.invalidateQueries({ queryKey: ["admin-users"] });
            setFormOpen(false);
          }}
        />
      )}
    </div>
  );
}

function UserFormModal({
  initial,
  branches,
  onClose,
  onSaved,
}: {
  initial: User | null;
  branches: Branch[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: initial
      ? {
          name: initial.name,
          email: initial.email,
          phone: initial.phone,
          role: initial.role,
          branchId: initial.branchId,
          status: initial.status,
        }
      : {
          name: "",
          email: "",
          phone: "+251 ",
          role: "cashier",
          branchId: branches[0]?.id ?? "",
          status: "active",
        },
  });

  const saveMut = useMutation({
    mutationFn: (data: UserFormData) =>
      catalogService.saveUser({
        id: initial?.id,
        name: data.name,
        email: data.email,
        phone: data.phone,
        role: data.role,
        branchId: data.branchId,
        status: data.status,
        password: data.password || undefined,
      }),
    onSuccess: () => {
      toast.success(initial ? "User updated." : "User created.");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? `Edit ${initial.name}` : "New user"}</DialogTitle>
          <DialogDescription>
            Assign a role and designated primary branch.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((d) => saveMut.mutate(d))} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Full name *</Label>
            <Input {...form.register("name")} placeholder="Abebe Kebede" />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Email address *</Label>
            <Input type="email" {...form.register("email")} placeholder="user@abaystationery.et" />
            {form.formState.errors.email && (
              <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>{initial ? "New password (leave blank to keep current)" : "Password *"}</Label>
            <Input
              type="password"
              {...form.register("password")}
              placeholder={initial ? "••••••••" : "Minimum 6 characters"}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Phone *</Label>
            <Input {...form.register("phone")} />
            {form.formState.errors.phone && (
              <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Role *</Label>
              <Select
                value={form.watch("role")}
                onValueChange={(v) => form.setValue("role", v as RoleKey)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_KEYS.map((rk) => (
                    <SelectItem key={rk} value={rk}>
                      {ROLES[rk].name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status *</Label>
              <Select
                value={form.watch("status")}
                onValueChange={(v) => form.setValue("status", v as "active" | "inactive")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Primary Branch *</Label>
            <Select
              value={form.watch("branchId")}
              onValueChange={(v) => form.setValue("branchId", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name} ({b.kind})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveMut.isPending}>
              {saveMut.isPending ? "Saving…" : initial ? "Save changes" : "Create user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ======================== Branches Tab ======================== */

const branchSchema = z.object({
  name: z.string().min(2, "Branch name is required"),
  code: z.string().min(2, "Short code is required"),
  kind: z.enum(["branch", "warehouse"]),
  address: z.string().min(2, "Address is required"),
  phone: z.string().min(7, "Phone is required"),
  status: z.enum(["active", "inactive"]),
});
type BranchFormData = z.infer<typeof branchSchema>;

function BranchesTab() {
  const { can } = useSession();
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);

  const branches = useQuery({
    queryKey: ["admin-branches"],
    queryFn: () => catalogService.getBranches(),
  });

  const columns: Array<Column<Branch>> = [
    {
      key: "name",
      header: "Location",
      render: (row) => (
        <div>
          <p className="font-medium">{row.name}</p>
          <p className="text-xs text-muted-foreground">{row.address}</p>
        </div>
      ),
      sortValue: (row) => row.name,
    },
    {
      key: "code",
      header: "Code",
      render: (row) => <span className="num text-xs font-semibold uppercase">{row.code}</span>,
      sortValue: (row) => row.code,
    },
    {
      key: "kind",
      header: "Type",
      render: (row) => (
        <span className="capitalize text-xs font-medium bg-muted px-2 py-0.5 rounded">
          {row.kind}
        </span>
      ),
      sortValue: (row) => row.kind,
    },
    {
      key: "phone",
      header: "Phone",
      render: (row) => <span className="num text-sm">{row.phone}</span>,
      hideOnMobile: true,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status} />,
      sortValue: (row) => row.status,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          {can("branches.manage") && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(row);
                setFormOpen(true);
              }}
            >
              Edit
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Stores and central warehouses across your distribution network.
        </p>
        {can("branches.manage") && (
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-2 size-4" />
            New location
          </Button>
        )}
      </div>

      <SectionCard contentClassName="p-0">
        <DataTable
          columns={columns}
          rows={branches.data ?? []}
          rowKey={(row) => row.id}
          loading={branches.isLoading}
          error={branches.error}
          onRetry={() => void branches.refetch()}
          pageSize={10}
          caption="Branches and warehouses"
        />
      </SectionCard>

      {formOpen && (
        <BranchFormModal
          initial={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            void qc.invalidateQueries({ queryKey: ["admin-branches"] });
            setFormOpen(false);
          }}
        />
      )}
    </div>
  );
}

function BranchFormModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: Branch | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const form = useForm<BranchFormData>({
    resolver: zodResolver(branchSchema),
    defaultValues: initial
      ? {
          name: initial.name,
          code: initial.code,
          kind: initial.kind,
          address: initial.address,
          phone: initial.phone,
          status: initial.status,
        }
      : {
          name: "",
          code: "",
          kind: "branch",
          address: "",
          phone: "+251 ",
          status: "active",
        },
  });

  const saveMut = useMutation({
    mutationFn: (data: BranchFormData) =>
      catalogService.saveBranch({
        id: initial?.id,
        name: data.name,
        code: data.code,
        kind: data.kind,
        address: data.address,
        phone: data.phone,
        status: data.status,
      }),
    onSuccess: () => {
      toast.success(initial ? "Branch updated." : "Branch created.");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? `Edit ${initial.name}` : "New branch / warehouse"}</DialogTitle>
          <DialogDescription>
            Configure inventory storage location or retail counter.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((d) => saveMut.mutate(d))} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Location name *</Label>
            <Input {...form.register("name")} placeholder="e.g. Bole Medhanialem Branch" />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Location code *</Label>
              <Input {...form.register("code")} placeholder="e.g. BOL-01" />
            </div>
            <div className="space-y-1.5">
              <Label>Type *</Label>
              <Select
                value={form.watch("kind")}
                onValueChange={(v) => form.setValue("kind", v as "branch" | "warehouse")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="branch">Branch (Retail)</SelectItem>
                  <SelectItem value="warehouse">Central Warehouse</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Address *</Label>
            <Input {...form.register("address")} placeholder="Sub-city, Woreda, Building" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Phone *</Label>
              <Input {...form.register("phone")} />
            </div>
            <div className="space-y-1.5">
              <Label>Status *</Label>
              <Select
                value={form.watch("status")}
                onValueChange={(v) => form.setValue("status", v as "active" | "inactive")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveMut.isPending}>
              {saveMut.isPending ? "Saving…" : initial ? "Save changes" : "Create location"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ======================== Roles Matrix Tab ======================== */

function RolesMatrixTab() {
  return (
    <div className="space-y-4">
      <SectionCard
        title="Roles & Permissions Matrix"
        description="System permission mapping across all 5 predefined roles. Permissions are enforced on each view and server endpoint."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="py-3 px-4 font-semibold text-foreground min-w-[200px]">
                  Module / Capability
                </th>
                {ROLE_KEYS.map((rk) => (
                  <th key={rk} className="py-3 px-3 text-center font-semibold text-foreground">
                    <div>{ROLES[rk].name}</div>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      {ROLES[rk].permissions.length} perms
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {PERMISSION_GROUPS.map((group) => (
                <FragmentGroup key={group.label} group={group} />
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

function FragmentGroup({
  group,
}: {
  group: { label: string; permissions: typeof ALL_PERMISSIONS };
}) {
  return (
    <>
      <tr className="bg-muted/20">
        <td
          colSpan={6}
          className="py-2 px-4 font-bold uppercase tracking-wider text-[11px] text-muted-foreground"
        >
          {group.label}
        </td>
      </tr>
      {group.permissions.map((perm) => (
        <tr key={perm} className="hover:bg-muted/10 transition-colors">
          <td className="py-2 px-4 font-mono text-[11px] text-muted-foreground">
            {perm}
          </td>
          {ROLE_KEYS.map((rk) => {
            const has = roleCan(rk, perm);
            return (
              <td key={rk} className="py-2 px-3 text-center">
                {has ? (
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                    <Check className="size-3.5" />
                  </span>
                ) : (
                  <span className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground/30">
                    <X className="size-3.5" />
                  </span>
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

/* ======================== Audit Log Tab ======================== */

function AuditLogTab() {
  const [search, setSearch] = useState("");

  const audit = useQuery({
    queryKey: ["admin-audit", search],
    queryFn: () => financeService.listAudit(search),
  });

  const users = catalogService.users();
  const branches = catalogService.branches();

  const columns: Array<Column<AuditLog>> = [
    {
      key: "date",
      header: "Timestamp",
      render: (row) => <DateDisplay value={row.createdAt} withTime />,
      sortValue: (row) => row.createdAt,
    },
    {
      key: "user",
      header: "Actor",
      render: (row) => {
        const u = users.find((x) => x.id === row.userId);
        return <span className="font-medium text-xs">{u?.name ?? row.userId}</span>;
      },
    },
    {
      key: "action",
      header: "Action",
      render: (row) => (
        <span className="rounded bg-muted px-2 py-0.5 text-xs font-semibold">
          {row.action}
        </span>
      ),
      sortValue: (row) => row.action,
    },
    {
      key: "entity",
      header: "Target",
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.entity} {row.entityId ? `#${row.entityId.slice(-6)}` : ""}
        </span>
      ),
    },
    {
      key: "branch",
      header: "Branch",
      render: (row) =>
        row.branchId
          ? branches.find((b) => b.id === row.branchId)?.name ?? row.branchId
          : "—",
      hideOnMobile: true,
    },
    {
      key: "description",
      header: "Details",
      render: (row) => <span className="text-xs text-foreground">{row.description}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Audit log entries are generated automatically whenever critical records (pricing, inventory adjustments, invoices, expenses) are modified.
      </p>
      <SectionCard contentClassName="p-0">
        <FilterBar>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search action or details…"
          />
        </FilterBar>
        <DataTable
          columns={columns}
          rows={audit.data ?? []}
          rowKey={(row) => row.id}
          loading={audit.isLoading}
          error={audit.error}
          onRetry={() => void audit.refetch()}
          pageSize={15}
          caption="System audit trail"
          empty={{
            title: "No audit records found",
            description: "Activity logs will appear here.",
          }}
        />
      </SectionCard>
    </div>
  );
}
