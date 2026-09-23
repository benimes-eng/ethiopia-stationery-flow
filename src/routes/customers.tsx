import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Users } from "lucide-react";
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
  FilterSelect,
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
import { documentsService } from "@/services/documents.service";
import { taxService } from "@/services/tax.service";
import { formatCurrency } from "@/lib/format";
import type { Customer, CustomerType } from "@/domain/types";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

export const Route = createFileRoute("/customers")({
  head: () => ({
    meta: [{ title: "Customers — Stationery Management" }],
  }),
  component: CustomersRoute,
});

function CustomersRoute() {
  return (
    <AppLayout permission="customers.view">
      <CustomersList />
    </AppLayout>
  );
}

const CUSTOMER_TYPES: CustomerType[] = [
  "Individual",
  "Business",
  "School",
  "NGO",
  "Government",
  "Other Organization",
];

const customerSchema = z.object({
  name: z.string().min(2, "Name is required"),
  type: z.enum(["Individual", "Business", "School", "NGO", "Government", "Other Organization"]),
  organization: z.string().optional(),
  tin: z.string().optional(),
  vatNumber: z.string().optional(),
  phone: z.string().min(7, "Phone is required"),
  email: z.string().email("Invalid email").or(z.literal("")).optional(),
  address: z.string().optional(),
});
type CustomerForm = z.infer<typeof customerSchema>;

function CustomersList() {
  const { can } = useSession();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<CustomerType | "all">("all");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  const customers = useQuery({
    queryKey: ["customers", search],
    queryFn: () => catalogService.listCustomers(search),
  });

  const filtered =
    typeFilter === "all"
      ? (customers.data ?? [])
      : (customers.data ?? []).filter((c) => c.type === typeFilter);

  const stats = {
    total: (customers.data ?? []).length,
    byType: CUSTOMER_TYPES.reduce(
      (acc, t) => ({
        ...acc,
        [t]: (customers.data ?? []).filter((c) => c.type === t).length,
      }),
      {} as Record<CustomerType, number>,
    ),
  };

  const invoices = documentsService.invoices();

  const columns: Array<Column<Customer>> = [
    {
      key: "name",
      header: "Customer",
      render: (row) => (
        <div>
          <p className="font-medium">{row.name}</p>
          {row.organization && (
            <p className="text-xs text-muted-foreground">{row.organization}</p>
          )}
        </div>
      ),
      sortValue: (row) => row.name,
    },
    {
      key: "type",
      header: "Type",
      render: (row) => <StatusBadge status={row.type} />,
      sortValue: (row) => row.type,
    },
    {
      key: "phone",
      header: "Phone",
      render: (row) => <span className="num text-sm">{row.phone}</span>,
      hideOnMobile: true,
    },
    {
      key: "tin",
      header: "TIN",
      render: (row) =>
        row.tin ? (
          <span className="num text-xs">{row.tin}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      hideOnMobile: true,
    },
    {
      key: "invoices",
      header: "Invoices",
      align: "right",
      render: (row) => (
        <span className="num">
          {invoices.filter((i) => i.customerId === row.id).length}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "since",
      header: "Since",
      render: (row) => <DateDisplay value={row.createdAt} />,
      sortValue: (row) => row.createdAt,
      hideOnMobile: true,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (row) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {can("customers.edit") && (
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
        title="Customers"
        description="Retail customers, businesses, schools, NGOs and government accounts. Customer credit is not supported — all sales are cash or bank."
        actions={
          can("customers.create") ? (
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus className="mr-2 size-4" />
              New customer
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total customers" value={String(stats.total)} loading={customers.isLoading} />
        <StatCard label="Businesses" value={String(stats.byType["Business"] ?? 0)} loading={customers.isLoading} />
        <StatCard label="Schools" value={String(stats.byType["School"] ?? 0)} loading={customers.isLoading} />
        <StatCard label="Government / NGO" value={String((stats.byType["Government"] ?? 0) + (stats.byType["NGO"] ?? 0))} loading={customers.isLoading} />
      </div>

      <SectionCard contentClassName="p-0">
        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name, org or phone" />
          <FilterSelect
            label="Type"
            value={typeFilter}
            onChange={(v) => setTypeFilter(v as typeof typeFilter)}
            options={[
              { value: "all", label: "All types" },
              ...CUSTOMER_TYPES.map((t) => ({ value: t, label: t })),
            ]}
          />
        </FilterBar>
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(row) => row.id}
          loading={customers.isLoading}
          error={customers.error}
          onRetry={() => void customers.refetch()}
          onRowClick={(row) => setSelected(row)}
          pageSize={12}
          caption="Customers"
          empty={{
            title: "No customers found",
            description: "Add customers to attach them to quotations, orders and invoices.",
            action: can("customers.create") ? (
              <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
                <Plus className="mr-2 size-4" />
                New customer
              </Button>
            ) : undefined,
          }}
        />
      </SectionCard>

      {/* Detail */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="size-4" />
              {selected?.name}
            </DialogTitle>
            <DialogDescription>
              {selected?.type}
              {selected?.organization ? ` · ${selected.organization}` : ""}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
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
                {selected.tin && (
                  <div>
                    <p className="text-muted-foreground">TIN</p>
                    <p className="num font-medium">{selected.tin}</p>
                  </div>
                )}
                {selected.vatNumber && (
                  <div>
                    <p className="text-muted-foreground">VAT number</p>
                    <p className="num font-medium">{selected.vatNumber}</p>
                  </div>
                )}
                {selected.address && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Address</p>
                    <p className="font-medium">{selected.address}</p>
                  </div>
                )}
              </div>

              <Separator />

              <div>
                <p className="mb-2 text-sm font-medium">Invoice history</p>
                {(() => {
                  const customerInvoices = invoices
                    .filter((i) => i.customerId === selected.id)
                    .slice(0, 5);
                  return customerInvoices.length > 0 ? (
                    <ul className="space-y-1 text-sm">
                      {customerInvoices.map((inv) => {
                        const total = taxService.computeDocument(inv.lines).total;
                        return (
                          <li key={inv.id} className="flex items-center justify-between gap-3">
                            <span className="num">{inv.number}</span>
                            <StatusBadge status={inv.status} />
                            <span className="num font-medium">{formatCurrency(total)}</span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No invoices yet.</p>
                  );
                })()}
              </div>

              <div className="rounded-md border border-amber-100 bg-amber-50 p-3 text-xs text-amber-700">
                Customer credit accounts are not supported in this version. All transactions require
                cash or bank payment at the time of sale.
              </div>
            </div>
          )}
          <DialogFooter>
            {can("customers.edit") && selected && (
              <Button
                variant="outline"
                onClick={() => { setEditing(selected); setFormOpen(true); setSelected(null); }}
              >
                Edit
              </Button>
            )}
            <Button onClick={() => setSelected(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {formOpen && (
        <CustomerFormDialog
          initial={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            void qc.invalidateQueries({ queryKey: ["customers"] });
            setFormOpen(false);
          }}
        />
      )}
    </div>
  );
}

function CustomerFormDialog({
  initial,
  onClose,
  onSaved,
}: {
  initial: Customer | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const form = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema),
    defaultValues: initial
      ? {
          name: initial.name,
          type: initial.type,
          organization: initial.organization ?? "",
          tin: initial.tin ?? "",
          vatNumber: initial.vatNumber ?? "",
          phone: initial.phone,
          email: initial.email ?? "",
          address: initial.address ?? "",
        }
      : {
          name: "",
          type: "Individual",
          organization: "",
          tin: "",
          vatNumber: "",
          phone: "",
          email: "",
          address: "",
        },
  });

  const saveMut = useMutation({
    mutationFn: (data: CustomerForm) =>
      catalogService.saveCustomer({
        id: initial?.id,
        name: data.name,
        type: data.type,
        organization: data.organization || undefined,
        tin: data.tin || undefined,
        vatNumber: data.vatNumber || undefined,
        phone: data.phone,
        email: data.email || undefined,
        address: data.address || undefined,
      }),
    onSuccess: () => {
      toast.success(initial ? "Customer updated." : "Customer created.");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const watchType = form.watch("type");

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? `Edit ${initial.name}` : "New customer"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((d) => saveMut.mutate(d))} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Full name / company name *</Label>
              <Input {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Customer type *</Label>
              <Select
                value={watchType}
                onValueChange={(v) => form.setValue("type", v as CustomerType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CUSTOMER_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {watchType !== "Individual" && (
              <div className="space-y-1.5">
                <Label>Organisation name</Label>
                <Input {...form.register("organization")} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Phone *</Label>
              <Input {...form.register("phone")} />
              {form.formState.errors.phone && (
                <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" {...form.register("email")} />
            </div>
            <div className="space-y-1.5">
              <Label>TIN</Label>
              <Input {...form.register("tin")} placeholder="Business TIN if applicable" />
            </div>
            <div className="space-y-1.5">
              <Label>VAT number</Label>
              <Input {...form.register("vatNumber")} placeholder="If VAT registered" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Address</Label>
              <Input {...form.register("address")} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saveMut.isPending}>
              {saveMut.isPending ? "Saving…" : initial ? "Save changes" : "Create customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
