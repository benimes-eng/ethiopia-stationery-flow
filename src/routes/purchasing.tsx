import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Truck } from "lucide-react";
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
import { SupplierSelector, LocationSelect } from "@/components/app/selectors";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSession } from "@/hooks/use-session";
import { purchasingService } from "@/services/purchasing.service";
import { catalogService } from "@/services/catalog.service";
import { formatCurrency, formatQuantity } from "@/lib/format";
import type { GoodsReceipt, PurchaseOrder, PurchaseOrderStatus } from "@/domain/types";

export const Route = createFileRoute("/purchasing")({
  head: () => ({
    meta: [
      { title: "Purchasing — Stationery Management" },
      {
        name: "description",
        content:
          "Manage purchase orders and goods receiving. Inventory increases only when goods are received.",
      },
    ],
  }),
  component: PurchasingRoute,
});

function PurchasingRoute() {
  return (
    <AppLayout permission="purchases.view">
      <PurchasingDashboard />
    </AppLayout>
  );
}

function PurchasingDashboard() {
  const { can } = useSession();
  const [activeTab, setActiveTab] = useState("orders");
  const [createOpen, setCreateOpen] = useState(false);
  const qc = useQueryClient();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchasing"
        description="Purchase orders, supplier deliveries and goods receiving. Stock is only updated when goods are received."
        actions={
          can("purchases.create") ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 size-4" />
              New purchase order
            </Button>
          ) : null
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="orders">Purchase orders</TabsTrigger>
          <TabsTrigger value="receiving">Goods receiving</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="mt-4">
          <PurchaseOrdersTab />
        </TabsContent>

        <TabsContent value="receiving" className="mt-4">
          <GoodsReceivingTab />
        </TabsContent>
      </Tabs>

      {createOpen && (
        <PurchaseOrderForm
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            void qc.invalidateQueries({ queryKey: ["purchase-orders"] });
            setCreateOpen(false);
          }}
        />
      )}
    </div>
  );
}

/* ======================== Purchase Orders Tab ======================== */

function PurchaseOrdersTab() {
  const { user, can } = useSession();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<PurchaseOrderStatus | "all">("all");
  const [selected, setSelected] = useState<PurchaseOrder | null>(null);
  const [receiveTarget, setReceiveTarget] = useState<PurchaseOrder | null>(null);
  const [cancelTarget, setCancelTarget] = useState<PurchaseOrder | null>(null);

  const orders = useQuery({
    queryKey: ["purchase-orders", search, status],
    queryFn: () => purchasingService.listOrders({ status, search }),
  });

  const suppliers = catalogService.suppliers();
  const branches = catalogService.branches();
  const products = catalogService.allProducts();

  const summary = {
    total: (orders.data ?? []).length,
    pending: (orders.data ?? []).filter((o) => o.status === "Pending Approval").length,
    value: (orders.data ?? []).reduce((s, o) => s + purchasingService.total(o), 0),
  };

  const approveMut = useMutation({
    mutationFn: (id: string) => purchasingService.setOrderStatus(id, "Approved", user!.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast.success("Purchase order approved.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => purchasingService.setOrderStatus(id, "Cancelled", user!.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast.success("Purchase order cancelled.");
      setCancelTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns: Array<Column<PurchaseOrder>> = [
    {
      key: "number",
      header: "PO number",
      render: (row) => <span className="num font-medium">{row.number}</span>,
      sortValue: (row) => row.number,
    },
    {
      key: "supplier",
      header: "Supplier",
      render: (row) => suppliers.find((s) => s.id === row.supplierId)?.name ?? "—",
    },
    {
      key: "location",
      header: "Location",
      render: (row) => branches.find((b) => b.id === row.locationId)?.name ?? "—",
      hideOnMobile: true,
    },
    {
      key: "date",
      header: "Date",
      render: (row) => <DateDisplay value={row.date} />,
      sortValue: (row) => row.date,
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      render: (row) => <CurrencyDisplay value={purchasingService.total(row)} className="font-medium" />,
      sortValue: (row) => purchasingService.total(row),
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
        <div
          className="flex items-center justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {can("purchases.approve") && row.status === "Pending Approval" && (
            <Button size="sm" variant="ghost" onClick={() => approveMut.mutate(row.id)}>
              Approve
            </Button>
          )}
          {can("purchases.receive") &&
            (row.status === "Approved" || row.status === "Partially Received") && (
              <Button size="sm" variant="outline" onClick={() => setReceiveTarget(row)}>
                <Truck className="mr-1 size-3.5" />
                Receive
              </Button>
            )}
          {row.status === "Draft" && can("purchases.create") && (
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
    <>
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total orders" value={String(summary.total)} loading={orders.isLoading} />
        <StatCard
          label="Awaiting approval"
          value={String(summary.pending)}
          tone={summary.pending > 0 ? "warning" : "default"}
          loading={orders.isLoading}
        />
        <StatCard
          label="Total order value"
          value={formatCurrency(summary.value)}
          loading={orders.isLoading}
        />
      </div>

      <SectionCard contentClassName="p-0">
        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder="Search by PO number" />
          <FilterSelect
            label="Status"
            value={status}
            onChange={(v) => setStatus(v as typeof status)}
            options={[
              { value: "all", label: "All statuses" },
              { value: "Draft", label: "Draft" },
              { value: "Pending Approval", label: "Pending Approval" },
              { value: "Approved", label: "Approved" },
              { value: "Partially Received", label: "Partially Received" },
              { value: "Received", label: "Received" },
              { value: "Cancelled", label: "Cancelled" },
            ]}
          />
        </FilterBar>
        <DataTable
          columns={columns}
          rows={orders.data ?? []}
          rowKey={(row) => row.id}
          loading={orders.isLoading}
          error={orders.error}
          onRetry={() => void orders.refetch()}
          onRowClick={(row) => setSelected(row)}
          pageSize={12}
          caption="Purchase orders"
          empty={{
            title: "No purchase orders yet",
            description: "Create your first purchase order to start tracking supplier deliveries.",
          }}
        />
      </SectionCard>

      {/* PO detail */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected?.number}</DialogTitle>
            <DialogDescription>
              {selected
                ? `${suppliers.find((s) => s.id === selected.supplierId)?.name ?? "—"} · ${selected.status}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Delivery location</p>
                  <p className="font-medium">
                    {branches.find((b) => b.id === selected.locationId)?.name ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Expected date</p>
                  <p className="num font-medium">
                    {selected.expectedDate ? (
                      <DateDisplay value={selected.expectedDate} />
                    ) : (
                      "Not specified"
                    )}
                  </p>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2">Product</th>
                    <th className="pb-2 text-right">Ordered</th>
                    <th className="pb-2 text-right">Received</th>
                    <th className="pb-2 text-right">Remaining</th>
                    <th className="pb-2 text-right">Unit cost</th>
                    <th className="pb-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {selected.items.map((item) => {
                    const product = products.find((p) => p.id === item.productId);
                    const remaining = item.quantity - item.receivedQty;
                    return (
                      <tr key={item.productId}>
                        <td className="py-2">{product?.name ?? item.productId}</td>
                        <td className="num py-2 text-right">{formatQuantity(item.quantity)}</td>
                        <td className="num py-2 text-right">{formatQuantity(item.receivedQty)}</td>
                        <td
                          className={`num py-2 text-right ${remaining > 0 ? "text-warning" : "text-emerald-600"}`}
                        >
                          {formatQuantity(remaining)}
                        </td>
                        <td className="num py-2 text-right">
                          {formatCurrency(item.unitCost)}
                        </td>
                        <td className="num py-2 text-right font-medium">
                          {formatCurrency(item.quantity * item.unitCost)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border font-semibold">
                    <td className="pt-2" colSpan={5}>Total</td>
                    <td className="num pt-2 text-right">
                      {formatCurrency(purchasingService.total(selected))}
                    </td>
                  </tr>
                </tfoot>
              </table>
              {selected.notes && (
                <p className="text-sm text-muted-foreground">{selected.notes}</p>
              )}
            </div>
          )}
          <DialogFooter>
            {selected &&
              can("purchases.receive") &&
              (selected.status === "Approved" || selected.status === "Partially Received") && (
                <Button
                  onClick={() => {
                    setReceiveTarget(selected);
                    setSelected(null);
                  }}
                >
                  <Truck className="mr-2 size-4" />
                  Receive goods
                </Button>
              )}
            <Button variant="outline" onClick={() => setSelected(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Goods receiving */}
      {receiveTarget && (
        <ReceivingForm
          order={receiveTarget}
          onClose={() => setReceiveTarget(null)}
          onSaved={() => {
            void qc.invalidateQueries({ queryKey: ["purchase-orders"] });
            void qc.invalidateQueries({ queryKey: ["stock"] });
            setReceiveTarget(null);
          }}
        />
      )}

      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title="Cancel purchase order?"
        description={`${cancelTarget?.number} will be marked Cancelled.`}
        confirmLabel="Cancel Order"
        destructive
        onConfirm={() => {
          if (cancelTarget) cancelMut.mutate(cancelTarget.id);
        }}
      />
    </>
  );
}

/* ======================== Goods Receiving Tab ======================== */

function GoodsReceivingTab() {
  const { user } = useSession();
  const qc = useQueryClient();
  const [receiveTarget, setReceiveTarget] = useState<PurchaseOrder | null>(null);

  const receivable = useQuery({
    queryKey: ["receivable-orders"],
    queryFn: async () => purchasingService.receivable(),
  });

  const receipts = useQuery({
    queryKey: ["goods-receipts"],
    queryFn: () => purchasingService.listReceipts(),
  });

  const suppliers = catalogService.suppliers();
  const branches = catalogService.branches();
  const products = catalogService.allProducts();

  return (
    <div className="space-y-4">
      {/* Awaiting receipt */}
      <SectionCard
        title="Orders awaiting receipt"
        description="Approved purchase orders ready for goods receiving."
        contentClassName="p-0"
      >
        <DataTable
          columns={[
            {
              key: "number",
              header: "PO number",
              render: (row) => <span className="num font-medium">{row.number}</span>,
            },
            {
              key: "supplier",
              header: "Supplier",
              render: (row) => suppliers.find((s) => s.id === row.supplierId)?.name ?? "—",
            },
            {
              key: "location",
              header: "Location",
              render: (row) => branches.find((b) => b.id === row.locationId)?.name ?? "—",
              hideOnMobile: true,
            },
            {
              key: "status",
              header: "Status",
              render: (row) => <StatusBadge status={row.status} />,
            },
            {
              key: "actions",
              header: "",
              align: "right",
              render: (row) => (
                <Button size="sm" onClick={() => setReceiveTarget(row)}>
                  <Truck className="mr-2 size-4" />
                  Receive
                </Button>
              ),
            },
          ]}
          rows={receivable.data ?? []}
          rowKey={(row) => row.id}
          loading={receivable.isLoading}
          pageSize={5}
          caption="Receivable orders"
          empty={{
            title: "No orders awaiting receipt",
            description: "Approved purchase orders will appear here.",
          }}
        />
      </SectionCard>

      {/* Receipts history */}
      <SectionCard title="Receipt history" contentClassName="p-0">
        <DataTable
          columns={[
            {
              key: "number",
              header: "GRN number",
              render: (row) => <span className="num font-medium">{row.number}</span>,
            },
            {
              key: "po",
              header: "PO",
              render: (row) => {
                const po = purchasingService
                  .orders()
                  .find((o) => o.id === row.purchaseOrderId);
                return <span className="num">{po?.number ?? "—"}</span>;
              },
            },
            {
              key: "date",
              header: "Date",
              render: (row) => <DateDisplay value={row.date} withTime />,
            },
            {
              key: "location",
              header: "Location",
              render: (row) => branches.find((b) => b.id === row.locationId)?.name ?? "—",
              hideOnMobile: true,
            },
            {
              key: "lines",
              header: "Products",
              align: "right",
              render: (row) => <span className="num">{row.items.length}</span>,
            },
          ]}
          rows={receipts.data ?? []}
          rowKey={(row) => row.id}
          loading={receipts.isLoading}
          pageSize={8}
          caption="Goods receipt history"
          empty={{ title: "No receipts yet", description: "Receipts will appear here after goods are received." }}
        />
      </SectionCard>

      {receiveTarget && (
        <ReceivingForm
          order={receiveTarget}
          onClose={() => setReceiveTarget(null)}
          onSaved={() => {
            void qc.invalidateQueries({ queryKey: ["purchase-orders"] });
            void qc.invalidateQueries({ queryKey: ["receivable-orders"] });
            void qc.invalidateQueries({ queryKey: ["goods-receipts"] });
            void qc.invalidateQueries({ queryKey: ["stock"] });
            setReceiveTarget(null);
          }}
        />
      )}
    </div>
  );
}

/* ======================== Receiving Form ======================== */

function ReceivingForm({
  order,
  onClose,
  onSaved,
}: {
  order: PurchaseOrder;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useSession();
  const products = catalogService.allProducts();
  const [lines, setLines] = useState<Array<{ productId: string; quantity: number; unitCost: number }>>(
    order.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity - item.receivedQty,
      unitCost: item.unitCost,
    })),
  );
  const [notes, setNotes] = useState("");

  const receiveMut = useMutation({
    mutationFn: () =>
      purchasingService.receive({
        purchaseOrderId: order.id,
        lines,
        userId: user!.id,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      toast.success("Goods received and inventory updated.");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Receive goods — {order.number}</DialogTitle>
          <DialogDescription>
            Enter the quantity actually received for each product. Inventory is updated on save.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
            <span className="col-span-4">Product</span>
            <span className="text-right col-span-2">Ordered</span>
            <span className="text-right col-span-2">Already received</span>
            <span className="text-right col-span-2">Receiving now</span>
            <span className="text-right col-span-2">Unit cost</span>
          </div>
          {order.items.map((item, i) => {
            const product = products.find((p) => p.id === item.productId);
            const remaining = item.quantity - item.receivedQty;
            return (
              <div
                key={item.productId}
                className="grid grid-cols-12 gap-2 items-center rounded-md border border-border px-3 py-2"
              >
                <div className="col-span-4">
                  <p className="text-sm font-medium">{product?.name ?? item.productId}</p>
                  <p className="num text-xs text-muted-foreground">{product?.sku}</p>
                </div>
                <span className="num col-span-2 text-right">
                  {formatQuantity(item.quantity)}
                </span>
                <span className="num col-span-2 text-right">
                  {formatQuantity(item.receivedQty)}
                </span>
                <div className="col-span-2">
                  <Input
                    type="number"
                    min="0"
                    max={remaining}
                    value={lines[i]?.quantity ?? 0}
                    onChange={(e) => {
                      const updated = [...lines];
                      if (updated[i]) updated[i].quantity = Number(e.target.value);
                      setLines(updated);
                    }}
                    className="h-7 text-right"
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={lines[i]?.unitCost ?? item.unitCost}
                    onChange={(e) => {
                      const updated = [...lines];
                      if (updated[i]) updated[i].unitCost = Number(e.target.value);
                      setLines(updated);
                    }}
                    className="h-7 text-right"
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="space-y-1.5">
          <Label>Notes</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any discrepancies, damage notes…" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => receiveMut.mutate()} disabled={receiveMut.isPending}>
            {receiveMut.isPending ? "Recording…" : "Confirm receipt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ======================== Purchase Order Form ======================== */

function PurchaseOrderForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useSession();
  const branches = catalogService.branches().filter((b) => b.status === "active");
  const products = catalogService.allProducts().filter((p) => p.status === "active");
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState(branches[0]?.id ?? "");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([{ productId: "", quantity: 1, unitCost: 0 }]);
  const [submit, setSubmit] = useState(false);

  const saveMut = useMutation({
    mutationFn: () =>
      purchasingService.saveOrder({
        supplierId: supplierId!,
        locationId,
        expectedDate: expectedDate || undefined,
        items: items.filter((i) => i.productId && i.quantity > 0),
        notes: notes || undefined,
        userId: user!.id,
        submitForApproval: submit,
      }),
    onSuccess: () => {
      toast.success(submit ? "Purchase order submitted for approval." : "Purchase order saved as draft.");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const total = items.reduce((s, i) => s + i.quantity * i.unitCost, 0);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New purchase order</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Supplier *</Label>
              <SupplierSelector value={supplierId} onChange={setSupplierId} />
            </div>
            <div className="space-y-1.5">
              <Label>Delivery location *</Label>
              <LocationSelect value={locationId} onChange={setLocationId} />
            </div>
            <div className="space-y-1.5">
              <Label>Expected delivery date</Label>
              <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Products</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setItems([...items, { productId: "", quantity: 1, unitCost: 0 }])}
              >
                <Plus className="mr-1 size-3.5" />
                Add
              </Button>
            </div>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-6">
                    <Select
                      value={item.productId}
                      onValueChange={(v) => {
                        const prod = products.find((p) => p.id === v);
                        const updated = [...items];
                        updated[i] = { ...updated[i], productId: v, unitCost: prod?.cost ?? 0 };
                        setItems(updated);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name} — {p.sku}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => {
                        const updated = [...items];
                        updated[i] = { ...updated[i], quantity: Number(e.target.value) };
                        setItems(updated);
                      }}
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Unit cost"
                      value={item.unitCost}
                      onChange={(e) => {
                        const updated = [...items];
                        updated[i] = { ...updated[i], unitCost: Number(e.target.value) };
                        setItems(updated);
                      }}
                    />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-8 text-destructive"
                      onClick={() => setItems(items.filter((_, j) => j !== i))}
                    >
                      ×
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <div className="text-sm font-semibold">
              Total: <span className="num">{formatCurrency(total)}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant="outline"
            disabled={saveMut.isPending || !supplierId}
            onClick={() => { setSubmit(false); saveMut.mutate(); }}
          >
            Save as draft
          </Button>
          <Button
            disabled={saveMut.isPending || !supplierId}
            onClick={() => { setSubmit(true); saveMut.mutate(); }}
          >
            Submit for approval
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
