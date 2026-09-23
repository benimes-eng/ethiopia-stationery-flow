import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  ClipboardList,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/app/app-layout";
import {
  CurrencyDisplay,
  DateDisplay,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
  ConfirmDialog,
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
import { Separator } from "@/components/ui/separator";
import { useSession } from "@/hooks/use-session";
import { documentsService } from "@/services/documents.service";
import { catalogService } from "@/services/catalog.service";
import { taxService } from "@/services/tax.service";
import { formatCurrency } from "@/lib/format";
import type { SalesOrder } from "@/domain/types";

export const Route = createFileRoute("/orders")({
  head: () => ({
    meta: [
      { title: "Sales Orders — Stationery Management" },
      {
        name: "description",
        content:
          "Manage confirmed sales orders. Convert fulfilled orders to invoices for payment collection.",
      },
    ],
  }),
  component: OrdersRoute,
});

function OrdersRoute() {
  return (
    <AppLayout permission="orders.view">
      <SalesOrdersList />
    </AppLayout>
  );
}

function SalesOrdersList() {
  const { user, can } = useSession();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<SalesOrder["status"] | "all">("all");
  const [selected, setSelected] = useState<SalesOrder | null>(null);
  const [convertTarget, setConvertTarget] = useState<SalesOrder | null>(null);
  const [cancelTarget, setCancelTarget] = useState<SalesOrder | null>(null);

  const orders = useQuery({
    queryKey: ["orders", search, status],
    queryFn: () => documentsService.listSalesOrders({ status }),
  });

  const customers = catalogService.customers();
  const branches = catalogService.branches();
  const products = catalogService.allProducts();

  const counts = {
    total: (orders.data ?? []).length,
    confirmed: (orders.data ?? []).filter((o) => o.status === "Confirmed").length,
    value: (orders.data ?? []).reduce(
      (s, o) => s + taxService.computeDocument(o.lines).total,
      0,
    ),
  };

  const convertMut = useMutation({
    mutationFn: (id: string) => documentsService.convertOrderToInvoice(id, user!.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["orders"] });
      void qc.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice created from sales order.");
      setConvertTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) =>
      documentsService.setSalesOrderStatus(id, "Cancelled", user!.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Sales order cancelled.");
      setCancelTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const confirmMut = useMutation({
    mutationFn: (id: string) =>
      documentsService.setSalesOrderStatus(id, "Confirmed", user!.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Sales order confirmed.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (orders.data ?? []).filter((o) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    const customer = customers.find((c) => c.id === o.customerId);
    return (
      o.number.toLowerCase().includes(q) ||
      (customer?.name ?? "").toLowerCase().includes(q)
    );
  });

  const columns: Array<Column<SalesOrder>> = [
    {
      key: "number",
      header: "Order no.",
      render: (row) => <span className="num font-medium">{row.number}</span>,
      sortValue: (row) => row.number,
    },
    {
      key: "customer",
      header: "Customer",
      render: (row) => customers.find((c) => c.id === row.customerId)?.name ?? "—",
    },
    {
      key: "date",
      header: "Date",
      render: (row) => <DateDisplay value={row.date} />,
      sortValue: (row) => row.date,
    },
    {
      key: "branch",
      header: "Branch",
      render: (row) => branches.find((b) => b.id === row.branchId)?.name ?? "—",
      hideOnMobile: true,
    },
    {
      key: "quotation",
      header: "From quotation",
      render: (row) =>
        row.quotationId ? (
          <span className="num text-xs text-muted-foreground">
            {/* Find quotation number from seeded data */}
            Linked
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
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
      key: "total",
      header: "Total",
      align: "right",
      render: (row) => (
        <CurrencyDisplay
          value={taxService.computeDocument(row.lines).total}
          className="font-medium"
        />
      ),
      sortValue: (row) => taxService.computeDocument(row.lines).total,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (row) => (
        <div
          className="flex items-center justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {can("orders.approve") && row.status === "Draft" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => confirmMut.mutate(row.id)}
            >
              Confirm
            </Button>
          )}
          {can("invoices.create") &&
            (row.status === "Confirmed" || row.status === "Partially Fulfilled") &&
            !row.invoiceId && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConvertTarget(row)}
              >
                <ArrowRight className="mr-1 size-3.5" />
                Invoice
              </Button>
            )}
          {can("orders.edit") &&
            row.status !== "Cancelled" &&
            row.status !== "Fulfilled" && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => setCancelTarget(row)}
              >
                Cancel
              </Button>
            )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Orders"
        description="Confirmed orders awaiting fulfilment. Convert to invoices once goods are ready for dispatch."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total orders" value={String(counts.total)} loading={orders.isLoading} />
        <StatCard
          label="Confirmed"
          value={String(counts.confirmed)}
          loading={orders.isLoading}
        />
        <StatCard
          label="Total value"
          value={formatCurrency(counts.value)}
          loading={orders.isLoading}
        />
      </div>

      <SectionCard contentClassName="p-0">
        <FilterBar>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by order number or customer"
          />
          <FilterSelect
            label="Status"
            value={status}
            onChange={(v) => setStatus(v as typeof status)}
            options={[
              { value: "all", label: "All statuses" },
              { value: "Draft", label: "Draft" },
              { value: "Confirmed", label: "Confirmed" },
              { value: "Partially Fulfilled", label: "Partially Fulfilled" },
              { value: "Fulfilled", label: "Fulfilled" },
              { value: "Cancelled", label: "Cancelled" },
            ]}
          />
        </FilterBar>
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(row) => row.id}
          loading={orders.isLoading}
          error={orders.error}
          onRetry={() => void orders.refetch()}
          onRowClick={(row) => setSelected(row)}
          pageSize={12}
          caption="Sales orders"
          empty={{
            title: "No sales orders found",
            description: "Sales orders are created from accepted quotations or directly.",
          }}
        />
      </SectionCard>

      {/* Detail modal */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              <ClipboardList className="mr-2 inline size-4" />
              {selected?.number}
            </DialogTitle>
            <DialogDescription>
              {selected ? `Status: ${selected.status}` : ""}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Customer</p>
                  <p className="font-medium">
                    {customers.find((c) => c.id === selected.customerId)?.name ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Branch</p>
                  <p className="font-medium">
                    {branches.find((b) => b.id === selected.branchId)?.name ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Date</p>
                  <p className="num font-medium">
                    <DateDisplay value={selected.date} />
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <StatusBadge status={selected.status} />
                </div>
              </div>
              <Separator />
              <div>
                <p className="mb-2 text-sm font-medium">Line items</p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="pb-2">Product</th>
                      <th className="pb-2 text-right">Qty</th>
                      <th className="pb-2 text-right">Unit price</th>
                      <th className="pb-2 text-right">Discount</th>
                      <th className="pb-2 text-right">Line total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {selected.lines.map((line, i) => {
                      const product = products.find((p) => p.id === line.productId);
                      const lineTotal =
                        line.quantity * line.unitPrice * (1 - line.discount / 100);
                      return (
                        <tr key={i}>
                          <td className="py-2">{product?.name ?? line.description}</td>
                          <td className="num py-2 text-right">{line.quantity}</td>
                          <td className="num py-2 text-right">
                            {formatCurrency(line.unitPrice)}
                          </td>
                          <td className="num py-2 text-right">{line.discount}%</td>
                          <td className="num py-2 text-right font-medium">
                            {formatCurrency(lineTotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Separator />
              <div className="flex justify-end">
                <div className="w-48 space-y-1 text-sm">
                  {(() => {
                    const totals = taxService.computeDocument(selected.lines);
                    return (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Subtotal</span>
                          <CurrencyDisplay value={totals.subtotal} />
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Tax</span>
                          <CurrencyDisplay value={totals.tax} />
                        </div>
                        <div className="flex justify-between border-t border-border pt-1 font-semibold">
                          <span>Total</span>
                          <CurrencyDisplay value={totals.total} />
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            {selected &&
              can("invoices.create") &&
              (selected.status === "Confirmed" || selected.status === "Partially Fulfilled") &&
              !selected.invoiceId && (
                <Button
                  onClick={() => {
                    setConvertTarget(selected);
                    setSelected(null);
                  }}
                >
                  <ArrowRight className="mr-2 size-4" />
                  Create Invoice
                </Button>
              )}
            <Button variant="outline" onClick={() => setSelected(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!convertTarget}
        onOpenChange={(open) => !open && setConvertTarget(null)}
        title="Create invoice?"
        description={`${convertTarget?.number} will be fulfilled and a new invoice will be issued for collection.`}
        confirmLabel="Create Invoice"
        onConfirm={() => {
          if (convertTarget) convertMut.mutate(convertTarget.id);
        }}
      />

      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title="Cancel sales order?"
        description={`${cancelTarget?.number} will be marked Cancelled. This action cannot be reversed.`}
        confirmLabel="Cancel Order"
        destructive
        onConfirm={() => {
          if (cancelTarget) cancelMut.mutate(cancelTarget.id);
        }}
      />
    </div>
  );
}
