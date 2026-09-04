import { useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Archive, Loader2, Pencil, Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/app/app-layout";
import {
  ConfirmDialog,
  CurrencyDisplay,
  PageHeader,
  PlannedFeatureNotice,
  SectionCard,
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
import { PRODUCT_CSV_TEMPLATE, catalogService } from "@/services/catalog.service";
import { inventoryService } from "@/services/inventory.service";
import { taxService } from "@/services/tax.service";
import { formatQuantity } from "@/lib/format";
import type { Product, UnitOfMeasure } from "@/domain/types";

const UNITS: UnitOfMeasure[] = ["Piece", "Pack", "Box", "Ream", "Carton", "Set"];

const schema = z.object({
  name: z.string().min(2, "Name is required."),
  sku: z.string().min(2, "SKU is required."),
  barcode: z.string().min(4, "Barcode is required."),
  categoryId: z.string().min(1, "Choose a category."),
  brandId: z.string().min(1, "Choose a brand."),
  description: z.string().optional(),
  unitOfMeasure: z.string().min(1),
  purchaseUnit: z.string().min(1),
  salesUnit: z.string().min(1),
  cost: z.coerce.number().min(0),
  retailPrice: z.coerce.number().min(0),
  wholesalePrice: z.coerce.number().min(0),
  reorderLevel: z.coerce.number().min(0),
  taxCategoryId: z.string().min(1),
  supplierId: z.string().optional(),
  status: z.enum(["active", "archived"]),
});
type FormValues = z.input<typeof schema>;

export const Route = createFileRoute("/products")({
  head: () => ({
    meta: [
      { title: "Product catalog — Abay Stationery Management" },
      {
        name: "description",
        content:
          "Manage stationery products, SKUs, barcodes, retail and wholesale pricing, tax categories and reorder levels across branches.",
      },
      { property: "og:title", content: "Product catalog — Abay Stationery Management" },
      {
        property: "og:description",
        content: "Catalog master data with validated CSV import and price controls.",
      },
    ],
  }),
  component: ProductsRoute,
});

function ProductsRoute() {
  return (
    <AppLayout permission="products.view">
      <ProductsScreen />
    </AppLayout>
  );
}

function ProductsScreen() {
  const { can, branchId } = useSession();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("active");
  const [editing, setEditing] = useState<Product | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [archiving, setArchiving] = useState<Product | null>(null);

  const categories = catalogService.categories();
  const brands = catalogService.brands();

  const products = useQuery({
    queryKey: ["products", search, category, status],
    queryFn: () =>
      catalogService.listProducts({
        search,
        categoryId: category === "all" ? undefined : category,
        status: status as "active" | "archived" | "all",
        pageSize: 200,
      }),
  });

  const rows = products.data?.rows ?? [];

  const columns: Array<Column<Product>> = [
    {
      key: "name",
      header: "Product",
      render: (row) => (
        <div>
          <p className="font-medium">{row.name}</p>
          <p className="num text-xs text-muted-foreground">
            {row.sku} · {row.barcode}
          </p>
        </div>
      ),
      sortValue: (row) => row.name,
    },
    {
      key: "category",
      header: "Category",
      render: (row) => categories.find((c) => c.id === row.categoryId)?.name ?? "—",
      hideOnMobile: true,
    },
    {
      key: "brand",
      header: "Brand",
      render: (row) => brands.find((b) => b.id === row.brandId)?.name ?? "—",
      hideOnMobile: true,
    },
    {
      key: "units",
      header: "Units",
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          Buy {row.purchaseUnit} · Sell {row.salesUnit}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "cost",
      header: "Cost",
      align: "right",
      render: (row) => <CurrencyDisplay value={row.cost} muted />,
      sortValue: (row) => row.cost,
      hideOnMobile: true,
    },
    {
      key: "retail",
      header: "Retail",
      align: "right",
      render: (row) => <CurrencyDisplay value={row.retailPrice} className="font-medium" />,
      sortValue: (row) => row.retailPrice,
    },
    {
      key: "wholesale",
      header: "Wholesale",
      align: "right",
      render: (row) => <CurrencyDisplay value={row.wholesalePrice} muted />,
      sortValue: (row) => row.wholesalePrice,
      hideOnMobile: true,
    },
    {
      key: "stock",
      header: "On hand",
      align: "right",
      render: (row) => {
        const quantity = inventoryService.quantityAt(row.id, branchId);
        return (
          <span className="flex items-center justify-end gap-2">
            <span className="num">{formatQuantity(quantity)}</span>
            <StatusBadge
              status={
                quantity <= 0
                  ? "Out of stock"
                  : quantity <= row.reorderLevel
                    ? "Low stock"
                    : "In stock"
              }
            />
          </span>
        );
      },
      sortValue: (row) => inventoryService.quantityAt(row.id, branchId),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (row) => (
        <span className="flex justify-end gap-1">
          {can("products.edit") ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={`Edit ${row.name}`}
              onClick={(event) => {
                event.stopPropagation();
                setEditing(row);
                setFormOpen(true);
              }}
            >
              <Pencil className="size-3.5" />
            </Button>
          ) : null}
          {can("products.delete") && row.status === "active" ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={`Archive ${row.name}`}
              onClick={(event) => {
                event.stopPropagation();
                setArchiving(row);
              }}
            >
              <Archive className="size-3.5" />
            </Button>
          ) : null}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Catalog master data shared by every branch, register and purchase order."
        actions={
          <>
            {can("products.create") ? (
              <>
                <Button variant="outline" onClick={() => setImportOpen(true)}>
                  <Upload className="mr-2 size-4" /> Import CSV
                </Button>
                <Button
                  onClick={() => {
                    setEditing(null);
                    setFormOpen(true);
                  }}
                >
                  <Plus className="mr-2 size-4" /> New product
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <PlannedFeatureNotice
        title="Break-pack and unit conversion"
        description="Purchase, stock and sales units are recorded per product, but automatic pack-to-piece decomposition is not applied yet. Conversion rules are reserved on the product model."
      />

      <SectionCard contentClassName="p-0">
        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder="Search name, SKU, barcode" />
          <FilterSelect
            label="Category"
            value={category}
            onChange={setCategory}
            options={[
              { value: "all", label: "All categories" },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          <FilterSelect
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { value: "active", label: "Active" },
              { value: "archived", label: "Archived" },
              { value: "all", label: "All" },
            ]}
          />
        </FilterBar>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          loading={products.isLoading}
          error={products.error}
          onRetry={() => void products.refetch()}
          pageSize={12}
          caption="Product catalog"
          empty={{
            title: "No products match these filters",
            description: "Try a different search term or add a new product.",
          }}
        />
      </SectionCard>

      <ProductFormDialog
        key={editing?.id ?? "new"}
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editing}
      />

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />

      <ConfirmDialog
        open={!!archiving}
        onOpenChange={(open) => !open && setArchiving(null)}
        title="Archive this product?"
        description="Archived products cannot be sold or ordered, but their sales history and stock ledger are preserved."
        confirmLabel="Archive"
        destructive
        onConfirm={async () => {
          if (!archiving) return;
          await catalogService.saveProduct({ ...archiving, status: "archived" });
          setArchiving(null);
          await queryClient.invalidateQueries({ queryKey: ["products"] });
          toast.success("Product archived");
        }}
      />
    </div>
  );
}

export function Field({
  label,
  error,
  children,
  hint,
}: {
  label: string;
  error?: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && !error ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  error,
  placeholder,
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  error?: string;
  placeholder?: string;
}) {
  return (
    <Field label={label} error={error}>
      <Select value={value ?? ""} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder ?? `Select ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function ProductFormDialog({
  open,
  onOpenChange,
  product,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
}) {
  const queryClient = useQueryClient();
  const { can } = useSession();
  const categories = catalogService.categories();
  const brands = catalogService.brands();
  const suppliers = catalogService.suppliers();
  const taxCategories = taxService.listCategories();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: product?.name ?? "",
      sku: product?.sku ?? "",
      barcode: product?.barcode ?? "",
      categoryId: product?.categoryId ?? categories[0]?.id ?? "",
      brandId: product?.brandId ?? brands[0]?.id ?? "",
      description: product?.description ?? "",
      unitOfMeasure: product?.unitOfMeasure ?? "Piece",
      purchaseUnit: product?.purchaseUnit ?? "Carton",
      salesUnit: product?.salesUnit ?? "Piece",
      cost: product?.cost ?? 0,
      retailPrice: product?.retailPrice ?? 0,
      wholesalePrice: product?.wholesalePrice ?? 0,
      reorderLevel: product?.reorderLevel ?? 10,
      taxCategoryId: product?.taxCategoryId ?? taxCategories[0]?.id ?? "",
      supplierId: product?.supplierId ?? "",
      status: product?.status ?? "active",
    },
  });
  const errors = form.formState.errors;

  const onSubmit = async (values: FormValues) => {
    const parsed = schema.parse(values);
    await catalogService.saveProduct({
      ...(product ? { id: product.id } : {}),
      name: parsed.name,
      sku: parsed.sku,
      barcode: parsed.barcode,
      categoryId: parsed.categoryId,
      brandId: parsed.brandId,
      description: parsed.description,
      unitOfMeasure: parsed.unitOfMeasure as UnitOfMeasure,
      purchaseUnit: parsed.purchaseUnit as UnitOfMeasure,
      salesUnit: parsed.salesUnit as UnitOfMeasure,
      cost: parsed.cost,
      retailPrice: parsed.retailPrice,
      wholesalePrice: parsed.wholesalePrice,
      reorderLevel: parsed.reorderLevel,
      taxCategoryId: parsed.taxCategoryId,
      supplierId: parsed.supplierId ? parsed.supplierId : null,
      status: parsed.status,
    });
    await queryClient.invalidateQueries({ queryKey: ["products"] });
    toast.success(product ? "Product updated" : "Product created");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{product ? "Edit product" : "New product"}</DialogTitle>
          <DialogDescription>
            Pricing is stored per product; branch-specific overrides are not supported in this
            release.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" error={errors.name?.message}>
              <Input {...form.register("name")} />
            </Field>
            <Field label="SKU" error={errors.sku?.message}>
              <Input className="num" {...form.register("sku")} />
            </Field>
            <Field label="Barcode" error={errors.barcode?.message}>
              <Input className="num" {...form.register("barcode")} />
            </Field>
            <SelectField
              label="Category"
              value={form.watch("categoryId")}
              onChange={(value) => form.setValue("categoryId", value)}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              error={errors.categoryId?.message}
            />
            <SelectField
              label="Brand"
              value={form.watch("brandId")}
              onChange={(value) => form.setValue("brandId", value)}
              options={brands.map((b) => ({ value: b.id, label: b.name }))}
              error={errors.brandId?.message}
            />
            <SelectField
              label="Tax category"
              value={form.watch("taxCategoryId")}
              onChange={(value) => form.setValue("taxCategoryId", value)}
              options={taxCategories.map((t) => ({
                value: t.id,
                label: `${t.name} (${t.rate * 100}%)`,
              }))}
              error={errors.taxCategoryId?.message}
            />
            <SelectField
              label="Stock unit"
              value={form.watch("unitOfMeasure")}
              onChange={(value) => form.setValue("unitOfMeasure", value)}
              options={UNITS.map((u) => ({ value: u, label: u }))}
            />
            <SelectField
              label="Purchase unit"
              value={form.watch("purchaseUnit")}
              onChange={(value) => form.setValue("purchaseUnit", value)}
              options={UNITS.map((u) => ({ value: u, label: u }))}
            />
            <SelectField
              label="Sales unit"
              value={form.watch("salesUnit")}
              onChange={(value) => form.setValue("salesUnit", value)}
              options={UNITS.map((u) => ({ value: u, label: u }))}
            />
            <SelectField
              label="Preferred supplier"
              value={form.watch("supplierId") || "none"}
              onChange={(value) => form.setValue("supplierId", value === "none" ? "" : value)}
              options={[
                { value: "none", label: "No preferred supplier" },
                ...suppliers.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
            <Field label="Cost (ETB)" error={errors.cost?.message}>
              <Input className="num" {...form.register("cost")} disabled={!can("products.price")} />
            </Field>
            <Field label="Retail price (ETB)" error={errors.retailPrice?.message}>
              <Input
                className="num"
                {...form.register("retailPrice")}
                disabled={!can("products.price")}
              />
            </Field>
            <Field label="Wholesale price (ETB)" error={errors.wholesalePrice?.message}>
              <Input
                className="num"
                {...form.register("wholesalePrice")}
                disabled={!can("products.price")}
              />
            </Field>
            <Field label="Reorder level" error={errors.reorderLevel?.message}>
              <Input className="num" {...form.register("reorderLevel")} />
            </Field>
            <SelectField
              label="Status"
              value={form.watch("status")}
              onChange={(value) => form.setValue("status", value as "active" | "archived")}
              options={[
                { value: "active", label: "Active" },
                { value: "archived", label: "Archived" },
              ]}
            />
          </div>
          <Field label="Description">
            <Textarea rows={2} {...form.register("description")} />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              {product ? "Save changes" : "Create product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [text, setText] = useState("");
  const parsed = text.trim() ? catalogService.parseProductCsv(text) : [];
  const valid = parsed.filter((row) => row.errors.length === 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import products from CSV</DialogTitle>
          <DialogDescription>
            Paste CSV content to validate it. Rows are checked for duplicate SKUs and numeric
            pricing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setText(PRODUCT_CSV_TEMPLATE)}>
              Load template
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setText("")}>
              Clear
            </Button>
          </div>
          <Textarea
            rows={8}
            className="num text-xs"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="name,sku,barcode,cost,retail_price,wholesale_price"
          />

          {parsed.length > 0 ? (
            <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-lg border border-border p-3 text-xs">
              {parsed.map((row) => (
                <div key={row.line} className="flex items-start justify-between gap-3">
                  <span className="num text-muted-foreground">Line {row.line}</span>
                  <span className="flex-1 truncate">{row.name || "(no name)"}</span>
                  {row.errors.length === 0 ? (
                    <StatusBadge status="Approved" />
                  ) : (
                    <span className="text-destructive">{row.errors.join(", ")}</span>
                  )}
                </div>
              ))}
            </div>
          ) : null}

          <PlannedFeatureNotice
            title="Server-side commit"
            description={`${valid.length} of ${parsed.length} rows are valid. Bulk creation is validated in the browser only; committing an import runs server-side once the backend API is connected.`}
            status="Pending backend"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
