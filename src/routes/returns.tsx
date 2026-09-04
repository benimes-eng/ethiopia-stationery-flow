import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/app/app-layout";
import {
  CurrencyDisplay,
  DateDisplay,
  PageHeader,
  PlannedFeatureNotice,
  SectionCard,
} from "@/components/app/primitives";
import { DataTable, SearchInput, type Column } from "@/components/app/data-table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/hooks/use-session";
import { salesService } from "@/services/sales.service";
import { catalogService } from "@/services/catalog.service";
import { formatCurrency, formatQuantity } from "@/lib/format";
import type { ReturnReason, Sale, SaleReturn } from "@/domain/types";

const REASONS: ReturnReason[] = [
  "Customer return",
  "Damaged",
  "Wrong product",
  "Duplicate",
  "Other",
];

export const Route = createFileRoute("/returns")({
  head: () => ({
    meta: [
      { title: "Sales returns — Abay Stationery Management" },
      {
        name: "description",
        content:
          "Record customer returns against the original sale, choose restock or write-off, and keep an auditable refund trail.",
      },
      { property: "og:title", content: "Sales returns — Abay Stationery Management" },
      {
        property: "og:description",
        content: "Return processing with mandatory original sale reference and stock impact.",
      },
    ],
  }),
  component: ReturnsRoute,
});

function ReturnsRoute() {
  return (
    <AppLayout permission="sales.return">
      <ReturnsScreen />
    </AppLayout>
  );
}

function ReturnsScreen() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const returns = useQuery({ queryKey: ["returns"], queryFn: () => salesService.listReturns() });
  const branches = catalogService.branches();
  const products = catalogService.allProducts();

  const columns: Array<Column<SaleReturn>> = [
    {
      key: "number",
      header: "Return",
      render: (row) => <span className="num font-medium">{row.number}</span>,
      sortValue: (row) => row.number,
    },
    {
      key: "date",
      header: "Date",
      render: (row) => <DateDisplay value={row.createdAt} withTime />,
      sortValue: (row) => row.createdAt,
    },
    {
      key: "branch",
      header: "Branch",
      render: (row) => branches.find((b) => b.id === row.branchId)?.name ?? "—",
      hideOnMobile: true,
    },
    {
      key: "items",
      header: "Items",
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.lines
            .map(
              (line) =>
                `${products.find((p) => p.id === line.productId)?.name ?? line.productId} ×${formatQuantity(line.quantity)}`,
            )
            .join(", ")}
        </span>
      ),
      hideOnMobile: true,
    },
    { key: "reason", header: "Reason", render: (row) => row.reason },
    {
      key: "value",
      header: "Refund value",
      align: "right",
      render: (row) => (
        <CurrencyDisplay
          value={row.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0)}
          className="font-medium"
        />
      ),
      sortValue: (row) => row.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Returns"
        description="Every return references its original sale so stock and revenue stay reconcilable."
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <RotateCcw className="mr-2 size-4" /> New return
          </Button>
        }
      />

      <PlannedFeatureNotice
        title="Credit notes and store credit"
        description="Refunds are recorded as cash-equivalent returns. Customer credit balances and formal credit notes arrive with the receivables module."
      />

      <SectionCard contentClassName="p-0">
        <DataTable
          columns={columns}
          rows={returns.data ?? []}
          rowKey={(row) => row.id}
          loading={returns.isLoading}
          error={returns.error}
          onRetry={() => void returns.refetch()}
          caption="Sales returns"
          empty={{
            title: "No returns recorded",
            description: "Returns you record against a sale will appear here.",
          }}
        />
      </SectionCard>

      <ReturnDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}

function ReturnDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [sale, setSale] = useState<Sale | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<ReturnReason>("Customer return");
  const [notes, setNotes] = useState("");
  const [restock, setRestock] = useState(true);
  const [busy, setBusy] = useState(false);

  const candidates = useQuery({
    queryKey: ["returnable-sales", search],
    queryFn: () => salesService.listSales({ search, status: "completed" }),
    enabled: open,
  });

  const products = catalogService.allProducts();
  const refund = useMemo(
    () =>
      (sale?.lines ?? []).reduce(
        (sum, line) => sum + (quantities[line.productId] ?? 0) * line.unitPrice,
        0,
      ),
    [sale, quantities],
  );

  const reset = () => {
    setSale(null);
    setQuantities({});
    setNotes("");
    setRestock(true);
    setReason("Customer return");
    setSearch("");
  };

  const submit = async () => {
    if (!sale || !user) return;
    const lines = sale.lines
      .filter((line) => (quantities[line.productId] ?? 0) > 0)
      .map((line) => ({
        productId: line.productId,
        quantity: quantities[line.productId] ?? 0,
        unitPrice: line.unitPrice,
      }));
    setBusy(true);
    try {
      const record = await salesService.createReturn({
        saleId: sale.id,
        lines,
        reason,
        notes,
        userId: user.id,
        restock,
      });
      await queryClient.invalidateQueries();
      toast.success(`Return ${record.number} recorded`);
      reset();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not record the return.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Record a return</DialogTitle>
          <DialogDescription>
            Find the original sale, then choose the quantities coming back.
          </DialogDescription>
        </DialogHeader>

        {!sale ? (
          <div className="space-y-3">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search by sale number"
              className="sm:max-w-none"
            />
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {candidates.isLoading ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Loading sales…</p>
              ) : (candidates.data ?? []).length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No completed sale matches this search.
                </p>
              ) : (
                (candidates.data ?? []).slice(0, 20).map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setSale(row)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-border p-3 text-left hover:border-primary/50 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span>
                      <span className="num block text-sm font-medium">{row.number}</span>
                      <span className="text-xs text-muted-foreground">
                        <DateDisplay value={row.createdAt} withTime /> · {row.lines.length} lines
                      </span>
                    </span>
                    <CurrencyDisplay
                      value={row.lines.reduce(
                        (s, l) => s + l.quantity * l.unitPrice - l.discount,
                        0,
                      )}
                    />
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <div>
                <p className="num text-sm font-medium">{sale.number}</p>
                <p className="text-xs text-muted-foreground">
                  <DateDisplay value={sale.createdAt} withTime />
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSale(null)}>
                Change sale
              </Button>
            </div>

            <div className="space-y-2">
              {sale.lines.map((line) => {
                const product = products.find((p) => p.id === line.productId);
                return (
                  <div
                    key={line.productId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {product?.name ?? line.description}
                      </p>
                      <p className="num text-xs text-muted-foreground">
                        Sold {formatQuantity(line.quantity)} @ {formatCurrency(line.unitPrice)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`qty-${line.productId}`} className="text-xs">
                        Return qty
                      </Label>
                      <Input
                        id={`qty-${line.productId}`}
                        className="num h-8 w-20"
                        value={quantities[line.productId] ?? 0}
                        onChange={(event) => {
                          const value = Math.min(
                            line.quantity,
                            Math.max(0, Number(event.target.value) || 0),
                          );
                          setQuantities((prev) => ({ ...prev, [line.productId]: value }));
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Reason</Label>
                <Select value={reason} onValueChange={(value) => setReason(value as ReturnReason)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REASONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Refund value</Label>
                <p className="num pt-2 text-lg font-semibold">{formatCurrency(refund)}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="return-notes">Notes</Label>
              <Textarea
                id="return-notes"
                rows={2}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Condition of goods, approval reference…"
              />
            </div>

            <label className="flex items-start gap-3 rounded-lg border border-border p-3">
              <Checkbox
                checked={restock}
                onCheckedChange={(checked) => setRestock(checked === true)}
              />
              <span className="text-sm">
                Return items to sellable stock
                <span className="block text-xs text-muted-foreground">
                  Leave unchecked for damaged goods — the quantity is written off instead.
                </span>
              </span>
            </label>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!sale || refund <= 0 || busy}>
            {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Record return
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
