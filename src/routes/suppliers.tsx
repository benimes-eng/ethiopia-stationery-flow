import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useSession } from "@/hooks/use-session";
import { catalogService } from "@/services/catalog.service";
import { purchasingService } from "@/services/purchasing.service";
import { formatCurrency } from "@/lib/format";
import type { Supplier } from "@/domain/types";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

export const Route = createFileRoute("/suppliers")({
  head: () => ({
    meta: [{ title: "Suppliers — Stationery Management" }],
  }),
  component: SuppliersRoute,
});

function SuppliersRoute() {
  return (
    <AppLayout permission="suppliers.view">
      <SuppliersList />
    </AppLayout>
  );
}

const supplierSchema = z.object({
  name: z.string().min(2, "Name is required"),
  legalName: z.string().min(2, "Legal name is required"),
  tin: z.string().min(1, "TIN is required"),
  vatNumber: z.string().optional(),
  contactName: z.string().min(1, "Contact name is required"),
  phone: z.string().min(7, "Phone is required"),
  email: z.string().email("Invalid email").or(z.literal("")),
  address: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["active", "inactive"]),
});
type SupplierForm = z.infer<typeof supplierSchema>;

function SuppliersList() {
  const { can } = useSession();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);

  const suppliers = useQuery({
    queryKey: ["suppliers", search],
    queryFn: () => catalogService.listSuppliers(search),
  });

  const orders = purchasingService.orders();

  const stats = {
    total: (suppliers.data ?? []).length,
    active: (suppliers.data ?? []).filter((s) => s.status === "active").length,
  };

  const columns: Array<Column<Supplier>> = [
    {
      key: "name",
      header: "Supplier",
      render: (row) => (
        <div>
          <p className="font-medium">{row.name}</p>
          <p className="text-xs text-muted-foreground">{row.legalName}</p>
        </div>
      ),
      sortValue: (row) => row.name,
    },
    {
      key: "contact",
      header: "Contact",
      render: (row) => (
        <div>
          <p className="text-sm">{row.contactName}</p>
          <p className="text-xs text-muted-foreground">{row.phone}</p>
        </div>
      ),
      hideOnMobile: true,
    },
    {
      key: "tin",
      header: "TIN",
      render: (row) => <span className="num text-xs">{row.tin}</span>,
      hideOnMobile: true,
    },
    {
      key: "orders",
      header: "POs",
      align: "right",
      render: (row) => (
        <span className="num">
          {orders.filter((o) => o.supplierId === row.id).length}
        </span>
      ),
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
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {can("suppliers.edit") && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setEditing(row); setFormOpen(true); }}
            >
              Edit
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suppliers"
        description="Vendor master data. Link suppliers to products and purchase orders."
        actions={
          can("suppliers.create") ? (
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus className="mr-2 size-4" />
              New supplier
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Total suppliers" value={String(stats.total)} loading={suppliers.isLoading} />
        <StatCard label="Active" value={String(stats.active)} loading={suppliers.isLoading} />
      </div>

      <SectionCard contentClassName="p-0">
        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name or contact" />
        </FilterBar>
        <DataTable
          columns={columns}
          rows={suppliers.data ?? []}
          rowKey={(row) => row.id}
          loading={suppliers.isLoading}
          error={suppliers.error}
          onRetry={() => void suppliers.refetch()}
          onRowClick={(row) => setSelected(row)}
          pageSize={12}
          caption="Suppliers"
          empty={{
            title: "No suppliers yet",
            description: "Add your first supplier to start creating purchase orders.",
            action: can("suppliers.create") ? (
              <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
                <Plus className="mr-2 size-4" />
                New supplier
              </Button>
            ) : undefined,
          }}
        />
      </SectionCard>

      {/* Supplier detail */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="size-4" />
              {selected?.name}
            </DialogTitle>
            <DialogDescription>{selected?.legalName}</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">TIN</p>
                  <p className="num font-medium">{selected.tin}</p>
                </div>
                {selected.vatNumber && (
                  <div>
                    <p className="text-muted-foreground">VAT number</p>
                    <p className="num font-medium">{selected.vatNumber}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground">Contact</p>
                  <p className="font-medium">{selected.contactName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Phone</p>
                  <p className="num font-medium">{selected.phone}</p>
                </div>
                {selected.email && (
                  <div>
                    <p className="text-muted-foreground">Email</p>
                    <p className="font-medium">{selected.email}</p>
                  </div>
                )}
                {selected.address && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Address</p>
                    <p className="font-medium">{selected.address}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <StatusBadge status={selected.status} />
                </div>
              </div>

              {selected.notes && (
                <>
                  <Separator />
                  <p className="text-sm text-muted-foreground">{selected.notes}</p>
                </>
              )}

              <Separator />
              <div>
                <p className="mb-2 text-sm font-medium">Purchase history</p>
                {(() => {
                  const supplierOrders = orders
                    .filter((o) => o.supplierId === selected.id)
                    .slice(0, 5);
                  return supplierOrders.length > 0 ? (
                    <ul className="space-y-1 text-sm">
                      {supplierOrders.map((o) => (
                        <li key={o.id} className="flex justify-between">
                          <span className="num">{o.number}</span>
                          <StatusBadge status={o.status} />
                          <span className="num">{formatCurrency(purchasingService.total(o))}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No purchase orders yet.</p>
                  );
                })()}
              </div>
            </div>
          )}
          <DialogFooter>
            {can("suppliers.edit") && selected && (
              <Button
                variant="outline"
                onClick={() => { setEditing(selected); setFormOpen(true); setSelected(null); }}
              >
                Edit supplier
              </Button>
            )}
            <Button onClick={() => setSelected(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {formOpen && (
        <SupplierFormDialog
          initial={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            void qc.invalidateQueries({ queryKey: ["suppliers"] });
            setFormOpen(false);
          }}
        />
      )}
    </div>
  );
}

function SupplierFormDialog({
  initial,
  onClose,
  onSaved,
}: {
  initial: Supplier | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const form = useForm<SupplierForm>({
    resolver: zodResolver(supplierSchema),
    defaultValues: initial
      ? {
          name: initial.name,
          legalName: initial.legalName,
          tin: initial.tin,
          vatNumber: initial.vatNumber ?? "",
          contactName: initial.contactName,
          phone: initial.phone,
          email: initial.email ?? "",
          address: initial.address ?? "",
          notes: initial.notes ?? "",
          status: initial.status,
        }
      : {
          name: "",
          legalName: "",
          tin: "",
          vatNumber: "",
          contactName: "",
          phone: "",
          email: "",
          address: "",
          notes: "",
          status: "active",
        },
  });

  const saveMut = useMutation({
    mutationFn: (data: SupplierForm) =>
      catalogService.saveSupplier({
        id: initial?.id,
        ...data,
        email: data.email || undefined,
        vatNumber: data.vatNumber || undefined,
        address: data.address || undefined,
        notes: data.notes || undefined,
      }),
    onSuccess: () => {
      toast.success(initial ? "Supplier updated." : "Supplier created.");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? `Edit ${initial.name}` : "New supplier"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((d) => saveMut.mutate(d))} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Trading name *</Label>
              <Input {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Legal name *</Label>
              <Input {...form.register("legalName")} />
            </div>
            <div className="space-y-1.5">
              <Label>TIN *</Label>
              <Input {...form.register("tin")} />
            </div>
            <div className="space-y-1.5">
              <Label>VAT number</Label>
              <Input {...form.register("vatNumber")} placeholder="If VAT registered" />
            </div>
            <div className="space-y-1.5">
              <Label>Contact person *</Label>
              <Input {...form.register("contactName")} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone *</Label>
              <Input {...form.register("phone")} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" {...form.register("email")} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
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
            <div className="col-span-2 space-y-1.5">
              <Label>Address</Label>
              <Input {...form.register("address")} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Notes</Label>
              <Textarea rows={2} {...form.register("notes")} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saveMut.isPending}>
              {saveMut.isPending ? "Saving…" : initial ? "Save changes" : "Create supplier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
