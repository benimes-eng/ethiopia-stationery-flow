import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Printer, X } from "lucide-react";
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
import { DocumentPreview } from "@/components/app/document-preview";
import { LocationSelect } from "@/components/app/selectors";
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
import { useSession } from "@/hooks/use-session";
import { documentsService } from "@/services/documents.service";
import { financeService } from "@/services/finance.service";
import { catalogService } from "@/services/catalog.service";
import { taxService } from "@/services/tax.service";
import { printerService } from "@/services/hardware.service";
import { formatCurrency } from "@/lib/format";
import type { Invoice } from "@/domain/types";

export const Route = createFileRoute("/invoices")({
  head: () => ({
    meta: [
      { title: "Invoices — Stationery Management" },
      {
        name: "description",
        content: "Manage issued invoices, record payments and track outstanding balances.",
      },
    ],
  }),
  component: InvoicesRoute,
});

function InvoicesRoute() {
  return (
    <AppLayout permission="invoices.view">
      <InvoicesList />
    </AppLayout>
  );
}

function InvoicesList() {
  const { user, can } = useSession();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Invoice["status"] | "all">("all");
  const [location, setLocation] = useState("all");
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<Invoice | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Invoice | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const invoices = useQuery({
    queryKey: ["invoices", search, status, location],
    queryFn: () => documentsService.listInvoices({ status, branchId: location, search }),
  });

  const customers = catalogService.customers();
  const branches = catalogService.branches();

  const summary = {
    total: (invoices.data ?? []).length,
    outstanding: (invoices.data ?? []).filter(
      (i) => i.status === "Issued" || i.status === "Partially Paid",
    ).length,
    paid: (invoices.data ?? []).filter((i) => i.status === "Paid").length,
    value: (invoices.data ?? []).reduce(
      (s, i) => s + taxService.computeDocument(i.lines).total,
      0,
    ),
  };

  const cancelMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      documentsService.cancelInvoice(id, reason, user!.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice cancelled and archived.");
      setCancelTarget(null);
      setCancelReason("");
      setSelected(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns: Array<Column<Invoice>> = [
    {
      key: "number",
      header: "Invoice no.",
      render: (row) => <span className="num font-medium">{row.number}</span>,
      sortValue: (row) => row.number,
    },
    {
      key: "customer",
      header: "Customer",
      render: (row) =>
        customers.find((c) => c.id === row.customerId)?.name ?? "Walk-in",
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
      key: "balance",
      header: "Balance",
      align: "right",
      render: (row) => {
        const balance = documentsService.balance(row);
        return (
          <CurrencyDisplay
            value={balance}
            className={balance > 0 ? "font-medium text-warning" : ""}
          />
        );
      },
      sortValue: (row) => documentsService.balance(row),
      hideOnMobile: true,
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
          {can("payments.create") &&
            (row.status === "Issued" || row.status === "Partially Paid") && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPaymentTarget(row)}
              >
                Record payment
              </Button>
            )}
          {can("invoices.cancel") &&
            row.status !== "Cancelled" &&
            row.status !== "Paid" && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => { setCancelTarget(row); setCancelReason(""); }}
              >
                <X className="size-3.5" />
              </Button>
            )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="All issued invoices. Record cash or bank payments to update balances. Cancelled invoices remain in history."
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Total" value={String(summary.total)} loading={invoices.isLoading} />
        <StatCard
          label="Outstanding"
          value={String(summary.outstanding)}
          tone={summary.outstanding > 0 ? "warning" : "default"}
          loading={invoices.isLoading}
        />
        <StatCard label="Paid" value={String(summary.paid)} tone="positive" loading={invoices.isLoading} />
        <StatCard
          label="Total invoiced"
          value={formatCurrency(summary.value)}
          loading={invoices.isLoading}
        />
      </div>

      <SectionCard contentClassName="p-0">
        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder="Search by invoice number" />
          <FilterSelect
            label="Status"
            value={status}
            onChange={(v) => setStatus(v as typeof status)}
            options={[
              { value: "all", label: "All statuses" },
              { value: "Draft", label: "Draft" },
              { value: "Issued", label: "Issued" },
              { value: "Partially Paid", label: "Partially Paid" },
              { value: "Paid", label: "Paid" },
              { value: "Cancelled", label: "Cancelled" },
            ]}
          />
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Branch</span>
            <LocationSelect value={location} onChange={setLocation} includeAll />
          </div>
        </FilterBar>
        <DataTable
          columns={columns}
          rows={invoices.data ?? []}
          rowKey={(row) => row.id}
          loading={invoices.isLoading}
          error={invoices.error}
          onRetry={() => void invoices.refetch()}
          onRowClick={(row) => setSelected(row)}
          pageSize={12}
          caption="Invoices list"
          empty={{
            title: "No invoices found",
            description: "Invoices are created from sales orders or POS sales.",
          }}
        />
      </SectionCard>

      {/* Invoice detail dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.number}</DialogTitle>
            <DialogDescription>
              Invoice detail — record payments below. Not a fiscal document.
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <>
              <DocumentPreview
                elementId={`invoice-print-${selected.id}`}
                kind="Invoice"
                number={selected.number}
                date={selected.date}
                status={selected.status}
                customerName={
                  customers.find((c) => c.id === selected.customerId)?.name ?? "Walk-in customer"
                }
                branchId={selected.branchId}
                lines={selected.lines}
                notes={selected.notes}
              />
              {/* Payment summary */}
              {(() => {
                const payments = financeService
                  .payments()
                  .filter((p) => p.invoiceId === selected.id);
                const balance = documentsService.balance(selected);
                return payments.length > 0 || balance > 0 ? (
                  <div className="rounded-md border border-border p-4">
                    <p className="mb-2 text-sm font-medium">Payment history</p>
                    {payments.map((p) => (
                      <div key={p.id} className="flex justify-between text-sm py-1">
                        <span className="text-muted-foreground">
                          {p.method} {p.bank ? `· ${p.bank}` : ""}{" "}
                          {p.reference ? `ref: ${p.reference}` : ""}
                        </span>
                        <CurrencyDisplay value={p.amount} />
                      </div>
                    ))}
                    <div className="flex justify-between border-t border-border pt-2 text-sm font-semibold">
                      <span>Outstanding balance</span>
                      <CurrencyDisplay value={balance} className={balance > 0 ? "text-warning" : ""} />
                    </div>
                  </div>
                ) : null;
              })()}
            </>
          )}
          <DialogFooter>
            {selected &&
              can("payments.create") &&
              (selected.status === "Issued" || selected.status === "Partially Paid") && (
                <Button
                  onClick={() => { setPaymentTarget(selected); setSelected(null); }}
                >
                  Record payment
                </Button>
              )}
            {selected && can("invoices.cancel") &&
              selected.status !== "Cancelled" && selected.status !== "Paid" && (
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => { setCancelTarget(selected); setCancelReason(""); setSelected(null); }}
                >
                  Cancel invoice
                </Button>
              )}
            <Button
              variant="outline"
              onClick={() => {
                if (selected) void printerService.printInvoice(`invoice-print-${selected.id}`);
              }}
            >
              <Printer className="mr-2 size-4" />
              Print
            </Button>
            <Button onClick={() => setSelected(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment recording */}
      {paymentTarget && (
        <PaymentForm
          invoice={paymentTarget}
          onClose={() => setPaymentTarget(null)}
          onSaved={() => {
            void qc.invalidateQueries({ queryKey: ["invoices"] });
            void qc.invalidateQueries({ queryKey: ["payments"] });
            setPaymentTarget(null);
          }}
        />
      )}

      {/* Cancel confirm */}
      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title="Cancel invoice?"
        description={`${cancelTarget?.number} will be marked Cancelled and remain in history. A paid invoice cannot be cancelled.`}
        confirmLabel="Cancel Invoice"
        destructive
        onConfirm={() => {
          if (cancelTarget && cancelReason.trim()) {
            cancelMut.mutate({ id: cancelTarget.id, reason: cancelReason });
          } else {
            toast.error("Please provide a cancellation reason.");
          }
        }}
        disabled={!cancelReason.trim()}
      >
        <div className="space-y-1.5">
          <Label htmlFor="cancel-reason">Reason *</Label>
          <Textarea
            id="cancel-reason"
            rows={2}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Briefly describe why this invoice is being cancelled"
          />
        </div>
      </ConfirmDialog>
    </div>
  );
}

const BANKS = [
  "Commercial Bank of Ethiopia",
  "Awash Bank",
  "Dashen Bank",
  "Bank of Abyssinia",
  "Hibret Bank",
  "Other",
];

function PaymentForm({
  invoice,
  onClose,
  onSaved,
}: {
  invoice: Invoice;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useSession();
  const balance = documentsService.balance(invoice);
  const [amount, setAmount] = useState(String(balance));
  const [method, setMethod] = useState<"Cash" | "Bank">("Cash");
  const [bank, setBank] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");

  const recordMut = useMutation({
    mutationFn: () =>
      financeService.recordPayment({
        invoiceId: invoice.id,
        amount: parseFloat(amount),
        method,
        bank: method === "Bank" ? bank : undefined,
        reference: method === "Bank" ? reference : undefined,
        userId: user!.id,
      }),
    onSuccess: () => {
      toast.success("Payment recorded.");
      onSaved();
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            {invoice.number} · Balance: {formatCurrency(balance)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Payment method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Cash">Cash</SelectItem>
                <SelectItem value="Bank">Bank transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {method === "Bank" && (
            <>
              <div className="space-y-1.5">
                <Label>Bank *</Label>
                <Select value={bank} onValueChange={setBank}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select bank" />
                  </SelectTrigger>
                  <SelectContent>
                    {BANKS.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Bank reference *</Label>
                <Input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Transaction or transfer reference"
                />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label>Amount (ETB) *</Label>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              max={balance}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Outstanding balance: {formatCurrency(balance)}
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
            This records a manual payment entry only. No bank API or payment gateway is connected.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => recordMut.mutate()} disabled={recordMut.isPending}>
            {recordMut.isPending ? "Recording…" : "Record payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
