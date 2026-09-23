import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowRight,
  FileText,
  Plus,
  Trash2,
  Printer,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/app/app-layout";
import {
  CurrencyDisplay,
  DateDisplay,
  PageHeader,
  SectionCard,
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
import {
  CustomerSelector,
} from "@/components/app/selectors";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import { catalogService } from "@/services/catalog.service";
import { taxService } from "@/services/tax.service";
import { printerService } from "@/services/hardware.service";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Quotation, QuotationStatus } from "@/domain/types";

export const Route = createFileRoute("/quotations")({
  head: () => ({
    meta: [
      { title: "Quotations — Stationery Management" },
      {
        name: "description",
        content:
          "Create and manage quotations for institutional and wholesale buyers. Convert accepted quotations to sales orders.",
      },
    ],
  }),
  component: QuotationsRoute,
});

function QuotationsRoute() {
  return (
    <AppLayout permission="quotations.view">
      <QuotationsList />
    </AppLayout>
  );
}

const lineSchema = z.object({
  productId: z.string().min(1, "Select a product"),
  description: z.string().min(1, "Description required"),
  quantity: z.coerce.number().positive("Must be > 0"),
  unitPrice: z.coerce.number().nonnegative(),
  discount: z.coerce.number().min(0).max(100),
  taxCategoryId: z.string(),
});

const quotationSchema = z.object({
  customerId: z.string().min(1, "Select a customer"),
  branchId: z.string().min(1, "Select a branch"),
  validUntil: z.string().min(1, "Set a validity date"),
  lines: z.array(lineSchema).min(1, "Add at least one product"),
  terms: z.string().optional(),
  notes: z.string().optional(),
});

type QuotationForm = z.infer<typeof quotationSchema>;

function QuotationsList() {
  const { user, can } = useSession();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<QuotationStatus | "all">("all");
  const [selected, setSelected] = useState<Quotation | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Quotation | null>(null);
  const [convertTarget, setConvertTarget] = useState<Quotation | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Quotation | null>(null);

  const quotations = useQuery({
    queryKey: ["quotations", search, status],
    queryFn: () => documentsService.listQuotations({ status, search }),
  });

  const customers = catalogService.customers();
  const branches = catalogService.branches();
  const products = catalogService.allProducts().filter((p) => p.status === "active");
  const taxCategories = taxService.categories();

  const setStatusMut = useMutation({
    mutationFn: ({ id, s }: { id: string; s: QuotationStatus }) =>
      documentsService.setQuotationStatus(id, s, user!.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["quotations"] });
      toast.success("Quotation status updated.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const convertMut = useMutation({
    mutationFn: (id: string) => documentsService.convertQuotationToOrder(id, user!.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["quotations"] });
      void qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Quotation converted to sales order.");
      setConvertTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns: Array<Column<Quotation>> = [
    {
      key: "number",
      header: "Number",
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
      key: "valid",
      header: "Valid until",
      render: (row) => <DateDisplay value={row.validUntil} />,
      hideOnMobile: true,
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
        <CurrencyDisplay value={taxService.computeDocument(row.lines).total} className="font-medium" />
      ),
      sortValue: (row) => taxService.computeDocument(row.lines).total,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (row) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {can("quotations.convert") && row.status === "Accepted" && (
            <Button size="sm" variant="outline" onClick={() => setConvertTarget(row)}>
              <ArrowRight className="mr-1 size-3.5" />
              Convert
            </Button>
          )}
          {can("quotations.edit") && (row.status === "Draft" || row.status === "Sent") && (
            <>
              {row.status === "Draft" && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setStatusMut.mutate({ id: row.id, s: "Sent" })}
                >
                  Send
                </Button>
              )}
              {row.status === "Sent" && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setStatusMut.mutate({ id: row.id, s: "Accepted" })}
                  >
                    Accept
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRejectTarget(row)}>
                    Reject
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotations"
        description="Prepare and send price offers to institutional or wholesale buyers. Accepted quotations convert directly to sales orders."
        actions={
          can("quotations.create") ? (
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus className="mr-2 size-4" />
              New quotation
            </Button>
          ) : null
        }
      />

      <SectionCard contentClassName="p-0">
        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder="Search by number" />
          <FilterSelect
            label="Status"
            value={status}
            onChange={(v) => setStatus(v as typeof status)}
            options={[
              { value: "all", label: "All statuses" },
              { value: "Draft", label: "Draft" },
              { value: "Sent", label: "Sent" },
              { value: "Accepted", label: "Accepted" },
              { value: "Rejected", label: "Rejected" },
              { value: "Expired", label: "Expired" },
              { value: "Converted", label: "Converted" },
            ]}
          />
        </FilterBar>
        <DataTable
          columns={columns}
          rows={quotations.data ?? []}
          rowKey={(row) => row.id}
          loading={quotations.isLoading}
          error={quotations.error}
          onRetry={() => void quotations.refetch()}
          onRowClick={(row) => setSelected(row)}
          pageSize={12}
          caption="Quotations list"
          empty={{
            title: "No quotations yet",
            description: "Create your first quotation for a wholesale buyer.",
            action: can("quotations.create") ? (
              <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
                <Plus className="mr-2 size-4" />
                New quotation
              </Button>
            ) : undefined,
          }}
        />
      </SectionCard>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected?.number}</DialogTitle>
            <DialogDescription>
              Quotation detail — not a fiscal document.
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <DocumentPreview
              elementId="quotation-print"
              kind="Quotation"
              number={selected.number}
              date={selected.date}
              status={selected.status}
              customerName={
                customers.find((c) => c.id === selected.customerId)?.name ?? "Walk-in"
              }
              branchId={selected.branchId}
              lines={selected.lines}
              notes={selected.notes}
              terms={selected.terms}
            />
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => void printerService.printReceipt("quotation-print")}
            >
              <Printer className="mr-2 size-4" />
              Print
            </Button>
            <Button onClick={() => setSelected(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/edit dialog */}
      {formOpen && (
        <QuotationForm
          initial={editing}
          products={products}
          taxCategories={taxCategories}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            void qc.invalidateQueries({ queryKey: ["quotations"] });
            setFormOpen(false);
          }}
        />
      )}

      {/* Convert confirm */}
      <ConfirmDialog
        open={!!convertTarget}
        onOpenChange={(open) => !open && setConvertTarget(null)}
        title="Convert to sales order?"
        description={`${convertTarget?.number} will be marked Converted and a new sales order will be created.`}
        confirmLabel="Convert"
        onConfirm={() => {
          if (convertTarget) convertMut.mutate(convertTarget.id);
        }}
      />

      {/* Reject confirm */}
      <ConfirmDialog
        open={!!rejectTarget}
        onOpenChange={(open) => !open && setRejectTarget(null)}
        title="Reject quotation?"
        description={`${rejectTarget?.number} will be marked Rejected.`}
        confirmLabel="Reject"
        destructive
        onConfirm={() => {
          if (rejectTarget) setStatusMut.mutate({ id: rejectTarget.id, s: "Rejected" });
          setRejectTarget(null);
        }}
      />
    </div>
  );
}

function QuotationForm({
  initial,
  products,
  taxCategories,
  onClose,
  onSaved,
}: {
  initial: Quotation | null;
  products: ReturnType<typeof catalogService.allProducts>;
  taxCategories: ReturnType<typeof taxService.categories>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useSession();
  const branches = catalogService.branches().filter((b) => b.status === "active");
  const defaultTaxId = taxCategories[0]?.id ?? "";

  const form = useForm<QuotationForm>({
    resolver: zodResolver(quotationSchema),
    defaultValues: initial
      ? {
          customerId: initial.customerId,
          branchId: initial.branchId,
          validUntil: initial.validUntil.slice(0, 10),
          lines: initial.lines.map((l) => ({
            ...l,
            quantity: l.quantity,
            discount: l.discount,
            taxCategoryId: l.taxCategoryId,
          })),
          terms: initial.terms ?? "",
          notes: initial.notes ?? "",
        }
      : {
          customerId: "",
          branchId: branches[0]?.id ?? "",
          validUntil: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
          lines: [
            {
              productId: "",
              description: "",
              quantity: 1,
              unitPrice: 0,
              discount: 0,
              taxCategoryId: defaultTaxId,
            },
          ],
          terms: "Prices are valid until the date shown above.",
          notes: "",
        },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lines" });

  const saveMut = useMutation({
    mutationFn: (data: QuotationForm) =>
      documentsService.saveQuotation({
        id: initial?.id,
        customerId: data.customerId,
        branchId: data.branchId,
        validUntil: data.validUntil,
        lines: data.lines.map((l) => ({
          productId: l.productId,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discount: l.discount,
          taxCategoryId: l.taxCategoryId,
        })),
        terms: data.terms,
        notes: data.notes,
        userId: user!.id,
        status: "Draft",
      }),
    onSuccess: () => {
      toast.success(initial ? "Quotation updated." : "Quotation created.");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const watchLines = form.watch("lines") || [];
  const totals = taxService.computeDocument(
    watchLines.map((l) => ({
      productId: l?.productId ?? "",
      description: l?.description ?? "",
      quantity: Number(l?.quantity) || 0,
      unitPrice: Number(l?.unitPrice) || 0,
      discount: Number(l?.discount) || 0,
      taxCategoryId: l?.taxCategoryId ?? defaultTaxId,
    })),
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <FileText className="mr-2 inline size-4" />
            {initial ? `Edit ${initial.number}` : "New quotation"}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit((d) => saveMut.mutate(d))}
          className="space-y-6"
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Customer *</Label>
              <CustomerSelector
                value={form.watch("customerId") || null}
                onChange={(v) => form.setValue("customerId", v ?? "")}
              />
              {form.formState.errors.customerId && (
                <p className="text-xs text-destructive">{form.formState.errors.customerId.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Branch *</Label>
              <Select value={form.watch("branchId")} onValueChange={(v) => form.setValue("branchId", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Valid until *</Label>
              <Input type="date" {...form.register("validUntil")} />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Line items</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  append({
                    productId: "",
                    description: "",
                    quantity: 1,
                    unitPrice: 0,
                    discount: 0,
                    taxCategoryId: defaultTaxId,
                  })
                }
              >
                <Plus className="mr-1 size-3.5" />
                Add line
              </Button>
            </div>
            <div className="space-y-2">
              {fields.map((field, index) => (
                <QuotationLineRow
                  key={field.id}
                  index={index}
                  form={form}
                  products={products}
                  taxCategories={taxCategories}
                  onRemove={() => remove(index)}
                />
              ))}
            </div>
            {form.formState.errors.lines?.root && (
              <p className="mt-1 text-xs text-destructive">
                {form.formState.errors.lines.root.message}
              </p>
            )}
          </div>

          <div className="flex justify-end">
            <div className="w-56 space-y-1 rounded-md border border-border bg-muted/30 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <CurrencyDisplay value={totals.subtotal} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discount</span>
                <CurrencyDisplay value={totals.discount} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <CurrencyDisplay value={totals.tax} />
              </div>
              <div className="flex justify-between border-t border-border pt-1 font-semibold">
                <span>Total</span>
                <CurrencyDisplay value={totals.total} />
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Terms</Label>
              <Textarea rows={2} {...form.register("terms")} placeholder="Payment terms, conditions…" />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea rows={2} {...form.register("notes")} placeholder="Internal notes…" />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveMut.isPending}>
              {saveMut.isPending ? "Saving…" : initial ? "Save changes" : "Create quotation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function QuotationLineRow({
  index,
  form,
  products,
  taxCategories,
  onRemove,
}: {
  index: number;
  form: ReturnType<typeof useForm<QuotationForm>>;
  products: ReturnType<typeof catalogService.allProducts>;
  taxCategories: ReturnType<typeof taxService.categories>;
  onRemove: () => void;
}) {
  const productId = form.watch(`lines.${index}.productId`);
  const selectedProduct = products.find((p) => p.id === productId);

  return (
    <div className="grid grid-cols-12 gap-2 rounded-md border border-border p-3">
      <div className="col-span-12 sm:col-span-4">
        <Label className="sr-only">Product</Label>
        <Select
          value={productId}
          onValueChange={(v) => {
            const prod = products.find((p) => p.id === v);
            form.setValue(`lines.${index}.productId`, v);
            if (prod) {
              form.setValue(`lines.${index}.description`, prod.name);
              form.setValue(`lines.${index}.unitPrice`, prod.wholesalePrice);
              form.setValue(`lines.${index}.taxCategoryId`, prod.taxCategoryId);
            }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select product" />
          </SelectTrigger>
          <SelectContent>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name} — {p.sku}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-6 sm:col-span-3">
        <Label className="sr-only">Description</Label>
        <Input placeholder="Description" {...form.register(`lines.${index}.description`)} />
      </div>
      <div className="col-span-3 sm:col-span-1">
        <Label className="sr-only">Qty</Label>
        <Input
          type="number"
          min="0.01"
          step="0.01"
          placeholder="Qty"
          {...form.register(`lines.${index}.quantity`)}
        />
      </div>
      <div className="col-span-3 sm:col-span-2">
        <Label className="sr-only">Unit price</Label>
        <Input
          type="number"
          min="0"
          step="0.01"
          placeholder="Price"
          {...form.register(`lines.${index}.unitPrice`)}
        />
      </div>
      <div className="col-span-3 sm:col-span-1">
        <Label className="sr-only">Discount %</Label>
        <Input
          type="number"
          min="0"
          max="100"
          placeholder="Disc%"
          {...form.register(`lines.${index}.discount`)}
        />
      </div>
      <div className="col-span-8 sm:col-span-1 flex items-center justify-end gap-1">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-8 shrink-0 text-destructive hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
      {selectedProduct && (
        <p className="col-span-12 text-xs text-muted-foreground">
          Cost: {formatCurrency(selectedProduct.cost)} · Retail:{" "}
          {formatCurrency(selectedProduct.retailPrice)} · Wholesale:{" "}
          {formatCurrency(selectedProduct.wholesalePrice)}
        </p>
      )}
    </div>
  );
}
