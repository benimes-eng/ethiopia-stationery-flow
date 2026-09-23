import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Minus, Pause, Play, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/app/app-layout";
import {
  PageHeader,
  PlannedFeatureNotice,
  SectionCard,
  StatusBadge,
} from "@/components/app/primitives";
import { CustomerSelector } from "@/components/app/selectors";
import { ReceiptPreview, TaxSummary } from "@/components/app/document-preview";
import { SearchInput } from "@/components/app/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/hooks/use-session";
import { usePosStore } from "@/stores/pos-store";
import { catalogService } from "@/services/catalog.service";
import { inventoryService } from "@/services/inventory.service";
import { taxService } from "@/services/tax.service";
import { ETHIOPIAN_BANKS, salesService, type CheckoutResult } from "@/services/sales.service";
import { barcodeScannerService, cashDrawerService } from "@/services/hardware.service";
import { persistDatabase } from "@/repositories/mock-repository";
import { formatCurrency, formatQuantity } from "@/lib/format";
import type { DocumentLine, PaymentMethod } from "@/domain/types";

export const Route = createFileRoute("/pos")({
  head: () => ({
    meta: [
      { title: "Point of sale — Stationery Management" },
      {
        name: "description",
        content:
          "Keyboard-first stationery register with retail and wholesale pricing, barcode scanning, cash and bank settlement, holds and receipt printing.",
      },
      { property: "og:title", content: "Point of sale — Stationery Management" },
      {
        property: "og:description",
        content: "Fast register checkout with ETB pricing, tax handling and receipt printing.",
      },
    ],
  }),
  component: PosRoute,
});

function PosRoute() {
  return (
    <AppLayout permission="pos.access">
      <Pos />
    </AppLayout>
  );
}

function Pos() {
  const { user, branchId, can } = useSession();
  const queryClient = useQueryClient();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [holdsOpen, setHoldsOpen] = useState(false);
  const [receipt, setReceipt] = useState<CheckoutResult | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("Cash");
  const [bank, setBank] = useState(ETHIOPIAN_BANKS[0]!);
  const [reference, setReference] = useState("");
  const [tendered, setTendered] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const lines = usePosStore((s) => s.lines);
  const channel = usePosStore((s) => s.channel);
  const customerId = usePosStore((s) => s.customerId);
  const registerId = usePosStore((s) => s.registerId);
  const addProduct = usePosStore((s) => s.addProduct);
  const setQuantity = usePosStore((s) => s.setQuantity);
  const setDiscount = usePosStore((s) => s.setDiscount);
  const setUnitPrice = usePosStore((s) => s.setUnitPrice);
  const removeLine = usePosStore((s) => s.removeLine);
  const setCustomer = usePosStore((s) => s.setCustomer);
  const setChannel = usePosStore((s) => s.setChannel);
  const loadLines = usePosStore((s) => s.loadLines);
  const clear = usePosStore((s) => s.clear);

  const branches = catalogService.branches().filter((b) => b.kind === "branch");
  const activeBranchId =
    (branchId !== "all" ? branchId : null) ?? user?.branchId ?? branches[0]?.id ?? "";
  const activeBranch = branches.find((b) => b.id === activeBranchId);

  const results = useMemo(() => catalogService.searchProducts(query, 24), [query]);

  const docLines: DocumentLine[] = lines.map((line) => ({
    productId: line.productId,
    description: line.description,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    discount: line.discount,
    taxCategoryId: line.taxCategoryId,
  }));
  const totals = taxService.computeDocument(docLines);
  const change = Math.max(0, Number(tendered || 0) - totals.total);

  const held = salesService.heldSales(activeBranchId);

  const addByCode = useCallback(
    (code: string) => {
      const product = catalogService.findByCode(code);
      if (!product) {
        toast.error(`No product matches “${code}”.`);
        return;
      }
      if (product.status !== "active") {
        toast.error(`${product.name} is archived and cannot be sold.`);
        return;
      }
      addProduct(product);
      toast.success(`${product.name} added`);
    },
    [addProduct],
  );

  useEffect(() => {
    void barcodeScannerService.initialize();
    const stop = barcodeScannerService.listen((code) => addByCode(code));
    return () => stop();
  }, [addByCode]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "F2") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "F4" && lines.length > 0) {
        event.preventDefault();
        setPaymentOpen(true);
      }
      if (event.key === "F8" && lines.length > 0) {
        event.preventDefault();
        void hold();
      }
      if (event.key === "Escape") setPaymentOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines.length]);

  const hold = async () => {
    if (!user || lines.length === 0) return;
    await salesService.holdSale({
      branchId: activeBranchId,
      registerId,
      cashierId: user.id,
      customerId,
      channel,
      lines: docLines,
    });
    clear();
    toast.success("Cart held. Resume it from the Holds list.");
  };

  const completeSale = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const amount = method === "Cash" ? Number(tendered || totals.total) : totals.total;
      const result = await salesService.checkout({
        branchId: activeBranchId,
        registerId,
        cashierId: user.id,
        customerId,
        channel,
        lines: docLines,
        payment: {
          method,
          amount,
          bank: method === "Bank" ? bank : undefined,
          reference: method === "Bank" ? reference : undefined,
        },
      });
      setReceipt(result);
      setPaymentOpen(false);
      setTendered("");
      setReference("");
      setNote("");
      clear();
      // Force immediate persist + cloud push so stock shows updated on all devices
      persistDatabase();
      await queryClient.invalidateQueries();
      toast.success(`Sale ${result.sale.number} completed`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Checkout failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Point of sale"
        description={`Register ${registerId} · ${activeBranch?.name ?? "No branch assigned"} · press F2 to search, F4 to pay, F8 to hold.`}
        actions={
          <>
            <Button variant="outline" onClick={() => setHoldsOpen(true)}>
              <Pause className="mr-2 size-4" /> Holds
              {held.length > 0 ? (
                <Badge variant="secondary" className="ml-2">
                  {held.length}
                </Badge>
              ) : null}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                cashDrawerService
                  .openDrawer()
                  .catch((error: Error) => toast.error(error.message))
              }
            >
              Open drawer
            </Button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <SectionCard contentClassName="p-4 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SearchInput
              inputRef={searchRef}
              value={query}
              onChange={setQuery}
              autoFocus
              placeholder="Scan barcode or search product (F2)"
              className="sm:max-w-none sm:flex-1"
            />
            <Tabs value={channel} onValueChange={(value) => setChannel(value as "retail" | "wholesale")}>
              <TabsList>
                <TabsTrigger value="retail">Retail</TabsTrigger>
                <TabsTrigger value="wholesale">Wholesale</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="grid max-h-[420px] gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
            {results.map((product) => {
              const stock = inventoryService.quantityAt(product.id, activeBranchId);
              const price = channel === "wholesale" ? product.wholesalePrice : product.retailPrice;
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => addProduct(product)}
                  className="flex flex-col rounded-lg border border-border p-3 text-left transition-colors hover:border-primary/50 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="line-clamp-2 text-sm font-medium">{product.name}</span>
                  <span className="num mt-0.5 text-xs text-muted-foreground">{product.sku}</span>
                  <span className="mt-2 flex items-center justify-between">
                    <span className="num text-sm font-semibold">{formatCurrency(price)}</span>
                    <span className="num text-xs text-muted-foreground">
                      {formatQuantity(stock)} {product.salesUnit.toLowerCase()}
                    </span>
                  </span>
                </button>
              );
            })}
            {results.length === 0 ? (
              <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
                No product matches this search or barcode.
              </p>
            ) : null}
          </div>

          <PlannedFeatureNotice
            title="Offline register queue"
            description="The register requires a connection today. Offline queuing with idempotent sync is in design."
            status="In design"
          />
        </SectionCard>

        <SectionCard contentClassName="space-y-4 p-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Customer</Label>
            <CustomerSelector value={customerId} onChange={setCustomer} />
          </div>

          <div className="max-h-[320px] space-y-2 overflow-y-auto">
            {lines.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Cart is empty. Scan a barcode or pick a product.
              </p>
            ) : (
              lines.map((line) => (
                <div key={line.productId} className="rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{line.name}</p>
                      <p className="num text-xs text-muted-foreground">{line.sku}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => removeLine(line.productId)}
                      aria-label={`Remove ${line.name}`}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-7"
                        onClick={() => setQuantity(line.productId, line.quantity - 1)}
                        aria-label="Decrease quantity"
                      >
                        <Minus className="size-3" />
                      </Button>
                      <Input
                        className="num h-7 w-14 text-center"
                        value={line.quantity}
                        onChange={(e) => setQuantity(line.productId, Number(e.target.value) || 0)}
                        aria-label={`Quantity for ${line.name}`}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-7"
                        onClick={() => setQuantity(line.productId, line.quantity + 1)}
                        aria-label="Increase quantity"
                      >
                        <Plus className="size-3" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-1">
                      <Label className="text-xs text-muted-foreground">Price</Label>
                      <Input
                        className="num h-7 w-24"
                        value={line.unitPrice}
                        disabled={!can("products.price")}
                        onChange={(e) => setUnitPrice(line.productId, Number(e.target.value) || 0)}
                        aria-label={`Unit price for ${line.name}`}
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <Label className="text-xs text-muted-foreground">Disc.</Label>
                      <Input
                        className="num h-7 w-20"
                        value={line.discount}
                        disabled={!can("sales.discount")}
                        onChange={(e) => setDiscount(line.productId, Number(e.target.value) || 0)}
                        aria-label={`Discount for ${line.name}`}
                      />
                    </div>
                    <span className="num ml-auto text-sm font-semibold">
                      {formatCurrency(taxService.computeLine(line).total)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="rounded-lg border border-border p-3">
            <TaxSummary lines={docLines} />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="outline" onClick={hold} disabled={lines.length === 0}>
              <Pause className="mr-2 size-4" /> Hold (F8)
            </Button>
            <Button variant="outline" onClick={clear} disabled={lines.length === 0}>
              <X className="mr-2 size-4" /> Clear
            </Button>
            <Button
              className="sm:col-span-2"
              size="lg"
              disabled={lines.length === 0 || !can("sales.create")}
              onClick={() => {
                setTendered(String(totals.total));
                setPaymentOpen(true);
              }}
            >
              Take payment (F4) · {formatCurrency(totals.total)}
            </Button>
          </div>
        </SectionCard>
      </div>

      {/* Payment */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Take payment</DialogTitle>
            <DialogDescription>
              Cash and manually recorded bank transfers only. Card and mobile money are not
              connected.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Tabs value={method} onValueChange={(value) => setMethod(value as PaymentMethod)}>
              <TabsList className="w-full">
                <TabsTrigger value="Cash" className="flex-1">
                  Cash
                </TabsTrigger>
                <TabsTrigger value="Bank" className="flex-1">
                  Bank transfer
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="rounded-lg border border-border p-3">
              <TaxSummary lines={docLines} />
            </div>

            {method === "Cash" ? (
              <div className="space-y-1.5">
                <Label htmlFor="tendered">Amount tendered</Label>
                <Input
                  id="tendered"
                  className="num"
                  value={tendered}
                  onChange={(e) => setTendered(e.target.value)}
                  inputMode="decimal"
                />
                <p className="num text-sm text-muted-foreground">
                  Change due: {formatCurrency(change)}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Bank</Label>
                  <Select value={bank} onValueChange={setBank}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ETHIOPIAN_BANKS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reference">Transfer reference</Label>
                  <Input
                    id="reference"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="e.g. FT26090412345"
                  />
                  <p className="text-xs text-muted-foreground">
                    References are recorded manually and are not verified with the bank.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="note">Internal note (optional)</Label>
              <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={completeSale}
              disabled={busy || (method === "Bank" && reference.trim().length === 0)}
            >
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Complete sale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Holds */}
      <Dialog open={holdsOpen} onOpenChange={setHoldsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Held carts</DialogTitle>
            <DialogDescription>Resume a parked cart for this register.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {held.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nothing on hold.</p>
            ) : (
              held.map((sale) => (
                <div
                  key={sale.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div>
                    <p className="num text-sm font-medium">{sale.number}</p>
                    <p className="text-xs text-muted-foreground">
                      {sale.lines.length} lines ·{" "}
                      {formatCurrency(taxService.computeDocument(sale.lines).total)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status="held" />
                    <Button
                      size="sm"
                      onClick={async () => {
                        const resumed = await salesService.resumeSale(sale.id);
                        loadLines(
                          resumed.lines.map((line) => {
                            const product = catalogService
                              .allProducts()
                              .find((p) => p.id === line.productId);
                            return {
                              ...line,
                              name: product?.name ?? line.description,
                              sku: product?.sku ?? "",
                              maxPrice: line.unitPrice,
                            };
                          }),
                          resumed.customerId,
                        );
                        setHoldsOpen(false);
                        toast.success(`Resumed ${resumed.number}`);
                      }}
                    >
                      <Play className="mr-2 size-3.5" /> Resume
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt */}
      <Dialog open={!!receipt} onOpenChange={(open) => !open && setReceipt(null)}>
        <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sale completed</DialogTitle>
            <DialogDescription>
              {receipt ? `Change due ${formatCurrency(receipt.change)}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {receipt ? (
              <ReceiptPreview
                number={receipt.sale.number}
                createdAt={receipt.sale.createdAt}
                branchId={receipt.sale.branchId}
                cashierName={user?.name ?? ""}
                customerName={
                  catalogService.customers().find((c) => c.id === receipt.sale.customerId)?.name
                }
                lines={receipt.sale.lines}
                payment={{
                  method: receipt.payment.method,
                  amount: receipt.payment.amount,
                  bank: receipt.payment.bank,
                  reference: receipt.payment.reference,
                }}
                change={receipt.change}
              />
            ) : null}
          </div>
          <DialogFooter className="mt-2 shrink-0">
            <Button onClick={() => setReceipt(null)}>New sale</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
