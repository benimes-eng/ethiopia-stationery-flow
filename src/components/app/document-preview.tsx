import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { catalogService } from "@/services/catalog.service";
import { taxService } from "@/services/tax.service";
import { fiscalAdapter } from "@/services/fiscal.service";
import { printerService } from "@/services/hardware.service";
import { formatCurrency, formatDateTime, formatQuantity } from "@/lib/format";
import type { DocumentLine } from "@/domain/types";

export function TaxSummary({ lines }: { lines: DocumentLine[] }) {
  const totals = taxService.computeDocument(lines);
  return (
    <dl className="space-y-1 text-sm">
      <Row label="Subtotal" value={formatCurrency(totals.subtotal)} />
      {totals.discount > 0 ? (
        <Row label="Discount" value={`- ${formatCurrency(totals.discount)}`} />
      ) : null}
      <Row label="Taxable amount" value={formatCurrency(totals.taxable)} />
      {totals.byCategory.map((category) => (
        <Row
          key={category.categoryId}
          label={`${category.name} (${(category.rate * 100).toFixed(0)}%)`}
          value={formatCurrency(category.tax)}
        />
      ))}
      <Separator className="my-2" />
      <Row label="Total" value={formatCurrency(totals.total)} strong />
    </dl>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className={strong ? "font-semibold" : "text-muted-foreground"}>{label}</dt>
      <dd className={`num ${strong ? "font-semibold" : ""}`}>{value}</dd>
    </div>
  );
}

function FiscalNotice() {
  const status = fiscalAdapter.status();
  return (
    <p className="mt-3 border-t border-dashed border-border pt-2 text-[11px] leading-snug text-muted-foreground">
      {status.detail} This document is not a fiscal receipt.
    </p>
  );
}

/* ------------------------------- Receipt -------------------------------- */

export function ReceiptPreview({
  elementId = "receipt-print-area",
  number,
  createdAt,
  branchId,
  cashierName,
  customerName,
  lines,
  payment,
  change,
}: {
  elementId?: string;
  number: string;
  createdAt: string;
  branchId: string;
  cashierName: string;
  customerName?: string;
  lines: DocumentLine[];
  payment?: { method: string; amount: number; reference?: string; bank?: string };
  change?: number;
}) {
  const tenant = catalogService.tenant();
  const branch = catalogService.branches().find((b) => b.id === branchId);
  const products = catalogService.allProducts();

  return (
    <div className="space-y-3">
      <div
        id={elementId}
        className="print-area mx-auto w-full max-w-[320px] rounded-md border border-border bg-card p-4 font-mono text-xs"
      >
        <div className="text-center">
          <p className="text-sm font-semibold">{tenant.legalName}</p>
          <p>{branch?.name ?? "Branch"}</p>
          <p>{branch?.address}</p>
          <p>TIN: {tenant.tin}</p>
          {tenant.vatRegistered ? <p>VAT: {tenant.vatNumber}</p> : null}
        </div>
        <Separator className="my-2" />
        <div className="space-y-0.5">
          <div className="flex justify-between">
            <span>Receipt</span>
            <span>{number}</span>
          </div>
          <div className="flex justify-between">
            <span>Date</span>
            <span>{formatDateTime(createdAt)}</span>
          </div>
          <div className="flex justify-between">
            <span>Cashier</span>
            <span>{cashierName}</span>
          </div>
          <div className="flex justify-between">
            <span>Customer</span>
            <span>{customerName ?? "Walk-in"}</span>
          </div>
        </div>
        <Separator className="my-2" />
        <div className="space-y-1">
          {lines.map((line) => {
            const totals = taxService.computeLine(line);
            const name =
              products.find((p) => p.id === line.productId)?.name ?? line.description ?? "Item";
            return (
              <div key={line.productId}>
                <p className="truncate">{name}</p>
                <div className="flex justify-between text-muted-foreground">
                  <span>
                    {formatQuantity(line.quantity)} × {formatCurrency(line.unitPrice, { symbol: false })}
                  </span>
                  <span>{formatCurrency(totals.total, { symbol: false })}</span>
                </div>
              </div>
            );
          })}
        </div>
        <Separator className="my-2" />
        <TaxSummary lines={lines} />
        {payment ? (
          <div className="mt-2 space-y-0.5">
            <div className="flex justify-between">
              <span>Paid ({payment.method})</span>
              <span className="num">{formatCurrency(payment.amount)}</span>
            </div>
            {payment.bank ? (
              <div className="flex justify-between">
                <span>Bank</span>
                <span>{payment.bank}</span>
              </div>
            ) : null}
            {payment.reference ? (
              <div className="flex justify-between">
                <span>Reference</span>
                <span>{payment.reference}</span>
              </div>
            ) : null}
            {change != null ? (
              <div className="flex justify-between">
                <span>Change</span>
                <span className="num">{formatCurrency(change)}</span>
              </div>
            ) : null}
          </div>
        ) : null}
        <p className="mt-3 text-center">Thank you for your business.</p>
        <FiscalNotice />
      </div>
      <div className="flex justify-center">
        <Button variant="outline" size="sm" onClick={() => printerService.printReceipt(elementId)}>
          <Printer className="mr-2 size-4" /> Print receipt
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------ A4 document ----------------------------- */

export function DocumentPreview({
  elementId = "document-print-area",
  kind,
  number,
  date,
  status,
  customerName,
  customerDetails,
  branchId,
  lines,
  notes,
  terms,
  footerNote,
}: {
  elementId?: string;
  kind: "Invoice" | "Quotation" | "Sales Order";
  number: string;
  date: string;
  status: string;
  customerName: string;
  customerDetails?: string[];
  branchId: string;
  lines: DocumentLine[];
  notes?: string;
  terms?: string;
  footerNote?: string;
}) {
  const tenant = catalogService.tenant();
  const branch = catalogService.branches().find((b) => b.id === branchId);
  const products = catalogService.allProducts();

  return (
    <div className="space-y-3">
      <div id={elementId} className="print-area rounded-md border border-border bg-card p-6 text-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-base font-semibold">{tenant.legalName}</p>
            <p className="text-muted-foreground">{branch?.name}</p>
            <p className="text-muted-foreground">{branch?.address}</p>
            <p className="text-muted-foreground">
              TIN {tenant.tin}
              {tenant.vatRegistered ? ` · VAT ${tenant.vatNumber}` : ""}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold uppercase tracking-wide">{kind}</p>
            <p className="num">{number}</p>
            <p className="text-muted-foreground">{formatDateTime(date)}</p>
            <p className="text-muted-foreground">Status: {status}</p>
          </div>
        </div>

        <Separator className="my-5" />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Billed to
            </p>
            <p className="font-medium">{customerName}</p>
            {customerDetails?.map((detail) => (
              <p key={detail} className="text-muted-foreground">
                {detail}
              </p>
            ))}
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Currency
            </p>
            <p>Ethiopian Birr (ETB)</p>
          </div>
        </div>

        <table className="mt-6 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2">Item</th>
              <th className="py-2 text-right">Qty</th>
              <th className="py-2 text-right">Unit price</th>
              <th className="py-2 text-right">Discount</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const totals = taxService.computeLine(line);
              const product = products.find((p) => p.id === line.productId);
              return (
                <tr key={line.productId} className="border-b border-border/60">
                  <td className="py-2">
                    <span className="font-medium">{product?.name ?? line.description}</span>
                    <span className="block text-xs text-muted-foreground">{product?.sku}</span>
                  </td>
                  <td className="num py-2 text-right">{formatQuantity(line.quantity)}</td>
                  <td className="num py-2 text-right">
                    {formatCurrency(line.unitPrice, { symbol: false })}
                  </td>
                  <td className="num py-2 text-right">
                    {formatCurrency(line.discount, { symbol: false })}
                  </td>
                  <td className="num py-2 text-right">
                    {formatCurrency(totals.total, { symbol: false })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:justify-between">
          <div className="max-w-sm space-y-2 text-xs text-muted-foreground">
            {terms ? (
              <p>
                <span className="font-semibold text-foreground">Terms: </span>
                {terms}
              </p>
            ) : null}
            {notes ? (
              <p>
                <span className="font-semibold text-foreground">Notes: </span>
                {notes}
              </p>
            ) : null}
            {footerNote ? <p>{footerNote}</p> : null}
          </div>
          <div className="w-full sm:w-64">
            <TaxSummary lines={lines} />
          </div>
        </div>

        <FiscalNotice />
      </div>
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => printerService.printInvoice(elementId)}>
          <Printer className="mr-2 size-4" /> Print / save as PDF
        </Button>
      </div>
    </div>
  );
}
