import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Boxes, Download, History, Minus, Plus, RotateCcw, Truck, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { exportToCSV } from "@/lib/csv";
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
import { LocationSelect, ProductSelector } from "@/components/app/selectors";
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
import { inventoryService, type StockRow } from "@/services/inventory.service";
import { catalogService } from "@/services/catalog.service";
import { formatCurrency, formatDate, formatQuantity } from "@/lib/format";
import type { AdjustmentReason, InventoryTransfer, InventoryCount } from "@/domain/types";

export const Route = createFileRoute("/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory — Stationery Management" },
      {
        name: "description",
        content:
          "Monitor stock balances, post adjustments, manage inter-branch transfers and run stock counts.",
      },
    ],
  }),
  component: InventoryRoute,
});

function InventoryRoute() {
  return (
    <AppLayout permission="inventory.view">
      <InventoryDashboard />
    </AppLayout>
  );
}

function InventoryDashboard() {
  const { can } = useSession();
  const [activeTab, setActiveTab] = useState("stock");
  const [location, setLocation] = useState("all");
  const [stockSearch, setStockSearch] = useState("");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [countOpen, setCountOpen] = useState(false);

  const summary = useQuery({
    queryKey: ["inventory-summary", location],
    queryFn: () => inventoryService.summary(location),
  });

  const stock = useQuery({
    queryKey: ["stock", location, stockSearch],
    queryFn: () => inventoryService.stockRows(location, stockSearch),
  });

  const branches = catalogService.branches().filter((b) => b.status === "active");

  const stockColumns: Array<Column<StockRow>> = [
    {
      key: "sku",
      header: "SKU",
      render: (row) => <span className="num text-xs">{row.product.sku}</span>,
      sortValue: (row) => row.product.sku,
      hideOnMobile: true,
    },
    {
      key: "product",
      header: "Product",
      render: (row) => (
        <div>
          <p className="font-medium">{row.product.name}</p>
          <p className="text-xs text-muted-foreground sm:hidden">{row.product.sku}</p>
        </div>
      ),
      sortValue: (row) => row.product.name,
    },
    {
      key: "location",
      header: "Location",
      render: (row) =>
        row.locationId === "all"
          ? "All locations"
          : branches.find((b) => b.id === row.locationId)?.name ?? "—",
      hideOnMobile: true,
    },
    {
      key: "qty",
      header: "Qty",
      align: "right",
      render: (row) => (
        <span className="num font-medium">{formatQuantity(row.quantity)}</span>
      ),
      sortValue: (row) => row.quantity,
    },
    {
      key: "avg-cost",
      header: "Avg cost",
      align: "right",
      render: (row) => <CurrencyDisplay value={row.averageCost} muted />,
      sortValue: (row) => row.averageCost,
      hideOnMobile: true,
    },
    {
      key: "retail-value",
      header: "Retail value",
      align: "right",
      render: (row) => <CurrencyDisplay value={row.retailValue} />,
      sortValue: (row) => row.retailValue,
      hideOnMobile: true,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status} />,
      sortValue: (row) => row.status,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Live stock balances, adjustments, inter-branch transfers and periodic stock counts."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const rowsData = (stock.data ?? []).map((r) => [
                  r.product.name,
                  r.product.sku,
                  r.product.barcode,
                  r.locationId === "all" ? "All Locations" : (branches.find((b) => b.id === r.locationId)?.name ?? r.locationId),
                  r.quantity,
                  r.product.unitOfMeasure,
                  r.averageCost,
                  r.product.retailPrice,
                  r.retailValue,
                  r.status,
                ]);
                const headers = [
                  "Product Name",
                  "SKU",
                  "Barcode",
                  "Location",
                  "Quantity On Hand",
                  "UOM",
                  "Average Cost",
                  "Retail Price",
                  "Total Retail Value",
                  "Stock Status",
                ];
                exportToCSV(`inventory_export_${location}_${new Date().toISOString().slice(0, 10)}.csv`, headers, rowsData);
                toast.success(`Exported ${rowsData.length} stock rows to CSV`);
              }}
            >
              <Download className="mr-2 size-4" />
              Export Stock CSV
            </Button>
            {can("inventory.adjust") && (
              <Button variant="outline" size="sm" onClick={() => setAdjustOpen(true)}>
                <Minus className="mr-2 size-4" />
                Adjust stock
              </Button>
            )}
            {can("inventory.transfer") && (
              <Button variant="outline" size="sm" onClick={() => setTransferOpen(true)}>
                <Truck className="mr-2 size-4" />
                New transfer
              </Button>
            )}
            {can("inventory.count") && (
              <Button variant="outline" size="sm" onClick={() => setCountOpen(true)}>
                <ClipboardCheck className="mr-2 size-4" />
                Start count
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Active SKUs" value={String(summary.data?.skuCount ?? 0)} loading={summary.isLoading} />
        <StatCard label="Total units" value={formatQuantity(summary.data?.units ?? 0)} loading={summary.isLoading} />
        <StatCard
          label="Stock at cost"
          value={formatCurrency(summary.data?.inventoryValue ?? 0)}
          loading={summary.isLoading}
        />
        <StatCard
          label="Low stock"
          value={String(summary.data?.lowStock ?? 0)}
          tone={summary.data && summary.data.lowStock > 0 ? "warning" : "default"}
          loading={summary.isLoading}
        />
        <StatCard
          label="Out of stock"
          value={String(summary.data?.outOfStock ?? 0)}
          tone={summary.data && summary.data.outOfStock > 0 ? "negative" : "default"}
          loading={summary.isLoading}
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="stock">
              <Boxes className="mr-2 size-4" />
              Stock
            </TabsTrigger>
            <TabsTrigger value="transfers">
              <Truck className="mr-2 size-4" />
              Transfers
            </TabsTrigger>
            <TabsTrigger value="counts">
              <ClipboardCheck className="mr-2 size-4" />
              Counts
            </TabsTrigger>
            <TabsTrigger value="ledger">
              <History className="mr-2 size-4" />
              Ledger
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Location</span>
            <LocationSelect value={location} onChange={setLocation} includeAll />
          </div>
        </div>

        <TabsContent value="stock" className="mt-4">
          <SectionCard contentClassName="p-0">
            <FilterBar>
              <SearchInput
                value={stockSearch}
                onChange={setStockSearch}
                placeholder="Search by name or SKU"
              />
            </FilterBar>
            <DataTable
              columns={stockColumns}
              rows={stock.data ?? []}
              rowKey={(row) => `${row.product.id}-${row.locationId}`}
              loading={stock.isLoading}
              error={stock.error}
              onRetry={() => void stock.refetch()}
              pageSize={15}
              caption="Current stock"
              empty={{
                title: "No products match your search",
                description: "Try adjusting the search or location filter.",
              }}
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="transfers" className="mt-4">
          <TransfersTab location={location} />
        </TabsContent>

        <TabsContent value="counts" className="mt-4">
          <CountsTab location={location} />
        </TabsContent>

        <TabsContent value="ledger" className="mt-4">
          <LedgerTab location={location} />
        </TabsContent>
      </Tabs>

      {adjustOpen && (
        <AdjustmentForm
          onClose={() => setAdjustOpen(false)}
          onSaved={() => {
            void stock.refetch();
            void summary.refetch();
            setAdjustOpen(false);
          }}
        />
      )}

      {transferOpen && (
        <TransferForm
          onClose={() => setTransferOpen(false)}
          onSaved={() => {
            void stock.refetch();
            void summary.refetch();
            setTransferOpen(false);
          }}
        />
      )}

      {countOpen && (
        <NewCountForm
          onClose={() => setCountOpen(false)}
          onSaved={() => setCountOpen(false)}
        />
      )}
    </div>
  );
}

/* ======================== Transfers Tab ======================== */

function TransfersTab({ location }: { location: string }) {
  const { user, can } = useSession();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const transfers = useQuery({
    queryKey: ["transfers", location],
    queryFn: () => inventoryService.listTransfers(),
  });

  const branches = catalogService.branches();

  const advanceMut = useMutation({
    mutationFn: ({ id, next }: { id: string; next: InventoryTransfer["status"] }) =>
      inventoryService.advanceTransfer(id, next, user!.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["transfers"] });
      void qc.invalidateQueries({ queryKey: ["stock"] });
      toast.success("Transfer status updated.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (transfers.data ?? []).filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (
      location !== "all" &&
      t.fromLocationId !== location &&
      t.toLocationId !== location
    )
      return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!t.reference.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const columns: Array<Column<InventoryTransfer>> = [
    {
      key: "ref",
      header: "Reference",
      render: (row) => <span className="num font-medium">{row.reference}</span>,
    },
    {
      key: "from",
      header: "From",
      render: (row) => branches.find((b) => b.id === row.fromLocationId)?.name ?? "—",
    },
    {
      key: "to",
      header: "To",
      render: (row) => branches.find((b) => b.id === row.toLocationId)?.name ?? "—",
    },
    {
      key: "date",
      header: "Date",
      render: (row) => <DateDisplay value={row.createdAt} />,
    },
    {
      key: "items",
      header: "Lines",
      align: "right",
      render: (row) => <span className="num">{row.lines.length}</span>,
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
        <div
          className="flex items-center justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {can("inventory.transfer") && row.status === "Requested" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => advanceMut.mutate({ id: row.id, next: "Approved" })}
            >
              Approve
            </Button>
          )}
          {can("inventory.transfer") && row.status === "Approved" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => advanceMut.mutate({ id: row.id, next: "In Transit" })}
            >
              Dispatch
            </Button>
          )}
          {can("inventory.receive") && row.status === "In Transit" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => advanceMut.mutate({ id: row.id, next: "Received" })}
            >
              <RotateCcw className="mr-1 size-3.5" />
              Receive
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <SectionCard contentClassName="p-0">
      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search by reference" />
        <FilterSelect
          label="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "all", label: "All" },
            { value: "Draft", label: "Draft" },
            { value: "Requested", label: "Requested" },
            { value: "Approved", label: "Approved" },
            { value: "In Transit", label: "In Transit" },
            { value: "Received", label: "Received" },
            { value: "Cancelled", label: "Cancelled" },
          ]}
        />
      </FilterBar>
      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(row) => row.id}
        loading={transfers.isLoading}
        error={transfers.error}
        onRetry={() => void transfers.refetch()}
        pageSize={10}
        caption="Inventory transfers"
        empty={{
          title: "No transfers found",
          description: "Create a transfer to move stock between branches.",
        }}
      />
    </SectionCard>
  );
}

/* ======================== Counts Tab ======================== */

function CountsTab({ location }: { location: string }) {
  const { user, can } = useSession();
  const qc = useQueryClient();
  const [activeCount, setActiveCount] = useState<InventoryCount | null>(null);

  const counts = useQuery({
    queryKey: ["counts"],
    queryFn: () => inventoryService.listCounts(),
  });

  const branches = catalogService.branches();
  const products = catalogService.allProducts();

  const approveMut = useMutation({
    mutationFn: (id: string) => inventoryService.approveCount(id, user!.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["counts"] });
      void qc.invalidateQueries({ queryKey: ["stock"] });
      toast.success("Stock count approved and posted to the ledger.");
      setActiveCount(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitMut = useMutation({
    mutationFn: (id: string) => inventoryService.submitCount(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["counts"] });
      toast.success("Stock count submitted for approval.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (counts.data ?? []).filter(
    (c) => location === "all" || c.locationId === location,
  );

  const columns: Array<Column<InventoryCount>> = [
    {
      key: "ref",
      header: "Reference",
      render: (row) => <span className="num font-medium">{row.reference}</span>,
    },
    {
      key: "location",
      header: "Location",
      render: (row) => branches.find((b) => b.id === row.locationId)?.name ?? "—",
    },
    {
      key: "date",
      header: "Date",
      render: (row) => <DateDisplay value={row.createdAt} />,
    },
    {
      key: "lines",
      header: "SKUs",
      align: "right",
      render: (row) => <span className="num">{row.lines.length}</span>,
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
        <div
          className="flex items-center justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {row.status === "Counting" && (
            <Button size="sm" variant="ghost" onClick={() => setActiveCount(row)}>
              Count
            </Button>
          )}
          {can("inventory.count") && row.status === "Counting" && (
            <Button size="sm" variant="ghost" onClick={() => submitMut.mutate(row.id)}>
              Submit
            </Button>
          )}
          {can("inventory.count") && row.status === "Pending Approval" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => approveMut.mutate(row.id)}
            >
              Approve
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <SectionCard contentClassName="p-0">
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(row) => row.id}
          loading={counts.isLoading}
          error={counts.error}
          onRetry={() => void counts.refetch()}
          pageSize={10}
          caption="Stock counts"
          empty={{
            title: "No stock counts yet",
            description: "Start a new count from the button above.",
          }}
        />
      </SectionCard>

      {activeCount && (
        <Dialog open onOpenChange={(open) => !open && setActiveCount(null)}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{activeCount.reference} — Physical count</DialogTitle>
              <DialogDescription>
                Enter physical quantities. Leave blank if not counted yet. System vs physical variance will be shown.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground px-1">
                <span className="col-span-2">Product</span>
                <span className="text-right">System qty</span>
                <span className="text-right">Physical qty</span>
              </div>
              {activeCount.lines.map((line) => {
                const product = products.find((p) => p.id === line.productId);
                const variance =
                  line.physicalQty != null ? line.physicalQty - line.systemQty : null;
                return (
                  <div
                    key={line.productId}
                    className="grid grid-cols-4 gap-2 items-center rounded-md border border-border px-3 py-2"
                  >
                    <div className="col-span-2">
                      <p className="text-sm font-medium">{product?.name ?? line.productId}</p>
                      <p className="num text-xs text-muted-foreground">{product?.sku}</p>
                    </div>
                    <span className="num text-right">{formatQuantity(line.systemQty)}</span>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        defaultValue={line.physicalQty ?? ""}
                        className="h-7 text-right"
                        onBlur={(e) => {
                          const val = e.target.value;
                          void inventoryService.saveCountLine(
                            activeCount.id,
                            line.productId,
                            val === "" ? null : Number(val),
                          );
                        }}
                      />
                      {variance != null && (
                        <span
                          className={`num shrink-0 text-xs ${
                            variance < 0
                              ? "text-destructive"
                              : variance > 0
                                ? "text-emerald-600"
                                : "text-muted-foreground"
                          }`}
                        >
                          {variance > 0 ? "+" : ""}
                          {variance}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setActiveCount(null)}>
                Save & Close
              </Button>
              {can("inventory.count") && (
                <Button onClick={() => submitMut.mutate(activeCount.id)}>
                  Submit for approval
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

/* ======================== Ledger Tab ======================== */

function LedgerTab({ location }: { location: string }) {
  const [txnType, setTxnType] = useState("all");
  const [productId, setProductId] = useState<string | null>(null);

  const ledger = useQuery({
    queryKey: ["ledger", location, txnType, productId],
    queryFn: () =>
      inventoryService.ledger({
        locationId: location,
        type: txnType === "all" ? undefined : (txnType as Parameters<typeof inventoryService.ledger>[0]["type"]),
        productId: productId ?? undefined,
      }),
  });

  const branches = catalogService.branches();
  const products = catalogService.allProducts();

  return (
    <SectionCard contentClassName="p-0">
      <FilterBar>
        <div className="space-y-1.5 w-full sm:max-w-xs">
          <span className="text-xs font-medium text-muted-foreground">Product</span>
          <ProductSelector value={productId} onChange={setProductId} />
        </div>
        <FilterSelect
          label="Type"
          value={txnType}
          onChange={setTxnType}
          options={[
            { value: "all", label: "All types" },
            { value: "PURCHASE", label: "Purchase" },
            { value: "SALE", label: "Sale" },
            { value: "RETURN", label: "Return" },
            { value: "TRANSFER_OUT", label: "Transfer out" },
            { value: "TRANSFER_IN", label: "Transfer in" },
            { value: "ADJUSTMENT", label: "Adjustment" },
            { value: "DAMAGE", label: "Damage" },
          ]}
        />
      </FilterBar>
      <p className="px-5 py-2 text-xs text-muted-foreground border-b border-border">
        Inventory ledger is append-only. Historical entries cannot be edited.
      </p>
      <DataTable
        columns={[
          {
            key: "date",
            header: "Date",
            render: (row) => <DateDisplay value={row.createdAt} withTime />,
          },
          {
            key: "product",
            header: "Product",
            render: (row) =>
              products.find((p) => p.id === row.productId)?.name ?? row.productId,
          },
          {
            key: "location",
            header: "Location",
            render: (row) => branches.find((b) => b.id === row.locationId)?.name ?? "—",
            hideOnMobile: true,
          },
          {
            key: "type",
            header: "Type",
            render: (row) => <StatusBadge status={row.type} />,
          },
          {
            key: "qty",
            header: "Qty",
            align: "right",
            render: (row) => (
              <span
                className={`num font-medium ${row.quantity < 0 ? "text-destructive" : "text-emerald-600"}`}
              >
                {row.quantity > 0 ? "+" : ""}
                {formatQuantity(row.quantity)}
              </span>
            ),
          },
          {
            key: "ref",
            header: "Reference",
            render: (row) => (
              <span className="num text-xs text-muted-foreground">{row.reference}</span>
            ),
            hideOnMobile: true,
          },
        ]}
        rows={ledger.data ?? []}
        rowKey={(row) => row.id}
        loading={ledger.isLoading}
        error={ledger.error}
        onRetry={() => void ledger.refetch()}
        pageSize={15}
        caption="Inventory ledger"
        empty={{ title: "No transactions found", description: "Adjust filters to see more." }}
      />
    </SectionCard>
  );
}

/* ======================== Adjustment Form ======================== */

const ADJUSTMENT_REASONS: AdjustmentReason[] = [
  "Damage",
  "Loss",
  "Found stock",
  "Counting correction",
  "Other",
];

function AdjustmentForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useSession();
  const branches = catalogService.branches().filter((b) => b.status === "active");
  const [productId, setProductId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState(branches[0]?.id ?? "");
  const [type, setType] = useState<"increase" | "decrease">("decrease");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState<AdjustmentReason>("Damage");
  const [notes, setNotes] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const currentQty = productId
    ? inventoryService.quantityAt(productId, locationId)
    : 0;
  const products = catalogService.allProducts();
  const product = products.find((p) => p.id === productId);
  const afterQty =
    type === "increase"
      ? currentQty + Number(quantity)
      : Math.max(0, currentQty - Number(quantity));

  const adjustMut = useMutation({
    mutationFn: () =>
      inventoryService.adjust({
        productId: productId!,
        locationId,
        type,
        quantity: Number(quantity),
        reason,
        notes: notes || undefined,
        userId: user!.id,
      }),
    onSuccess: () => {
      toast.success("Stock adjustment posted.");
      onSaved();
    },
    onError: (e: Error) => { toast.error(e.message); setConfirmOpen(false); },
  });

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust stock</DialogTitle>
            <DialogDescription>
              Post a manual stock adjustment. This creates an immutable ledger entry.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Product *</Label>
              <ProductSelector value={productId} onChange={setProductId} />
            </div>
            <div className="space-y-1.5">
              <Label>Location *</Label>
              <LocationSelect value={locationId} onChange={setLocationId} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Type *</Label>
                <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="decrease">
                      <Minus className="mr-2 inline size-3.5 text-destructive" />
                      Decrease
                    </SelectItem>
                    <SelectItem value="increase">
                      <Plus className="mr-2 inline size-3.5 text-emerald-600" />
                      Increase
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Quantity *</Label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Reason *</Label>
              <Select value={reason} onValueChange={(v) => setReason(v as AdjustmentReason)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADJUSTMENT_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            {productId && (
              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current qty ({product?.name})</span>
                  <span className="num font-medium">{formatQuantity(currentQty)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">After adjustment</span>
                  <span className={`num font-medium ${type === "decrease" ? "text-destructive" : "text-emerald-600"}`}>
                    {formatQuantity(afterQty)}
                  </span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              disabled={!productId || !quantity || Number(quantity) <= 0}
              onClick={() => setConfirmOpen(true)}
            >
              Review adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => !open && setConfirmOpen(false)}
        title="Confirm stock adjustment?"
        description={`${type === "increase" ? "Increase" : "Decrease"} ${product?.name ?? ""} by ${quantity} units. Reason: ${reason}. This action creates an immutable ledger entry.`}
        confirmLabel="Post adjustment"
        onConfirm={() => adjustMut.mutate()}
      />
    </>
  );
}

/* ======================== Transfer Form ======================== */

function TransferForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useSession();
  const branches = catalogService.branches().filter((b) => b.status === "active");
  const products = catalogService.allProducts().filter((p) => p.status === "active");
  const [fromId, setFromId] = useState(branches[0]?.id ?? "");
  const [toId, setToId] = useState(branches[1]?.id ?? "");
  const [lines, setLines] = useState([{ productId: "", quantity: 1 }]);

  const createMut = useMutation({
    mutationFn: () =>
      inventoryService.createTransfer({
        fromLocationId: fromId,
        toLocationId: toId,
        lines: lines.filter((l) => l.productId && l.quantity > 0),
        userId: user!.id,
        submit: true,
      }),
    onSuccess: () => {
      toast.success("Transfer request created.");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New stock transfer</DialogTitle>
          <DialogDescription>
            Stock leaves the source when dispatched and arrives at the destination when received.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>From location *</Label>
              <Select value={fromId} onValueChange={setFromId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>To location *</Label>
              <Select value={toId} onValueChange={setToId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {branches.filter((b) => b.id !== fromId).map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Products to transfer</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setLines([...lines, { productId: "", quantity: 1 }])}
              >
                <Plus className="mr-1 size-3.5" />
                Add
              </Button>
            </div>
            <div className="space-y-2">
              {lines.map((line, i) => {
                const avail = line.productId
                  ? inventoryService.quantityAt(line.productId, fromId)
                  : 0;
                return (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-7">
                      <Select
                        value={line.productId}
                        onValueChange={(v) => {
                          const updated = [...lines];
                          updated[i] = { ...updated[i], productId: v };
                          setLines(updated);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} ({formatQuantity(inventoryService.quantityAt(p.id, fromId))} available)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3">
                      <Input
                        type="number"
                        min="1"
                        max={avail}
                        value={line.quantity}
                        onChange={(e) => {
                          const updated = [...lines];
                          updated[i] = { ...updated[i], quantity: Number(e.target.value) };
                          setLines(updated);
                        }}
                      />
                    </div>
                    <div className="col-span-2 flex justify-end">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-8 text-destructive"
                        onClick={() => setLines(lines.filter((_, j) => j !== i))}
                      >
                        ×
                      </Button>
                    </div>
                    {line.productId && avail < line.quantity && (
                      <p className="col-span-12 text-xs text-destructive">
                        Only {formatQuantity(avail)} available at source.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={
              createMut.isPending ||
              fromId === toId ||
              !lines.some((l) => l.productId && l.quantity > 0)
            }
            onClick={() => createMut.mutate()}
          >
            {createMut.isPending ? "Creating…" : "Create transfer request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ======================== New Count Form ======================== */

function NewCountForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useSession();
  const branches = catalogService.branches().filter((b) => b.status === "active");
  const [locationId, setLocationId] = useState(branches[0]?.id ?? "");

  const createMut = useMutation({
    mutationFn: () => inventoryService.createCount(locationId, user!.id),
    onSuccess: () => {
      toast.success("Stock count created. Go to the Counts tab to enter quantities.");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Start stock count</DialogTitle>
          <DialogDescription>
            All active products at the selected location will be added to the count sheet.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Location *</Label>
          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => createMut.mutate()} disabled={!locationId || createMut.isPending}>
            {createMut.isPending ? "Creating…" : "Create count"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
