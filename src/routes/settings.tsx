import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building,
  Check,
  Cpu,
  FileSpreadsheet,
  Percent,
  Plus,
  Printer,
  Receipt,
  RotateCcw,
  ScanBarcode,
  Sparkles,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { resetDatabase, resetDataCategories, type DataResetOptions } from "@/repositories/mock-repository";
import { Checkbox } from "@/components/ui/checkbox";
import { AppLayout } from "@/components/app/app-layout";
import {
  PageHeader,
  SectionCard,
  StatusBadge,
  PlannedFeatureNotice,
} from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/hooks/use-session";
import { catalogService } from "@/services/catalog.service";
import { taxService } from "@/services/tax.service";
import {
  barcodeScannerService,
  cashDrawerService,
  printerService,
} from "@/services/hardware.service";
import { FEATURE_LIST } from "@/domain/features";
import type { TaxCategory, Tenant } from "@/domain/types";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Stationery Management" },
      {
        name: "description",
        content:
          "Configure business profile, Ethiopian tax rules, invoice layouts, POS hardware and system features.",
      },
    ],
  }),
  component: SettingsRoute,
});

function SettingsRoute() {
  return (
    <AppLayout permission="settings.manage">
      <SettingsDashboard />
    </AppLayout>
  );
}

function SettingsDashboard() {
  const [activeTab, setActiveTab] = useState("company");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Configure Ethiopian enterprise identity, taxation rules, documents, hardware interfaces and feature modules."
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:grid-cols-5">
          <TabsTrigger value="company">
            <Building className="mr-2 size-4" />
            Company
          </TabsTrigger>
          <TabsTrigger value="tax">
            <Percent className="mr-2 size-4" />
            Taxation
          </TabsTrigger>
          <TabsTrigger value="documents">
            <FileSpreadsheet className="mr-2 size-4" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="hardware">
            <Cpu className="mr-2 size-4" />
            Hardware
          </TabsTrigger>
          <TabsTrigger value="features">
            <Sparkles className="mr-2 size-4" />
            Features
          </TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="mt-4">
          <CompanySettingsTab />
        </TabsContent>

        <TabsContent value="tax" className="mt-4">
          <TaxSettingsTab />
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <DocumentSettingsTab />
        </TabsContent>

        <TabsContent value="hardware" className="mt-4">
          <HardwareSettingsTab />
        </TabsContent>

        <TabsContent value="features" className="mt-4">
          <FeaturesSettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ======================== Company Tab ======================== */

const companySchema = z.object({
  legalName: z.string().min(2, "Legal name is required"),
  tradingName: z.string().min(2, "Trading name is required"),
  tin: z.string().min(5, "Valid TIN required"),
  vatNumber: z.string().optional(),
  vatRegistered: z.boolean(),
  phone: z.string().min(7, "Phone is required"),
  email: z.string().email("Valid email required"),
  address: z.string().min(3, "Address is required"),
});
type CompanyFormData = z.infer<typeof companySchema>;

function CompanySettingsTab() {
  const qc = useQueryClient();
  const tenant = catalogService.tenant();

  const form = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      legalName: tenant.legalName,
      tradingName: tenant.tradingName,
      tin: tenant.tin,
      vatNumber: tenant.vatNumber ?? "",
      vatRegistered: tenant.vatRegistered,
      phone: tenant.phone,
      email: tenant.email,
      address: tenant.address,
    },
  });

  const updateMut = useMutation({
    mutationFn: (data: CompanyFormData) =>
      catalogService.updateTenant({
        legalName: data.legalName,
        tradingName: data.tradingName,
        tin: data.tin,
        vatNumber: data.vatNumber || undefined,
        vatRegistered: data.vatRegistered,
        phone: data.phone,
        email: data.email,
        address: data.address,
      }),
    onSuccess: () => {
      toast.success("Company profile saved successfully.");
      void qc.invalidateQueries({ queryKey: ["tenant"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <SectionCard
      title="Enterprise Legal Profile"
      description="Business legal name, Ethiopian tax identification number (TIN) and official registration data."
    >
      <form onSubmit={form.handleSubmit((d) => updateMut.mutate(d))} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Legal entity name *</Label>
            <Input {...form.register("legalName")} />
            {form.formState.errors.legalName && (
              <p className="text-xs text-destructive">{form.formState.errors.legalName.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Trading name / brand *</Label>
            <Input {...form.register("tradingName")} />
          </div>
          <div className="space-y-1.5">
            <Label>TIN (Tax Identification Number) *</Label>
            <Input {...form.register("tin")} />
            {form.formState.errors.tin && (
              <p className="text-xs text-destructive">{form.formState.errors.tin.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>VAT registration number</Label>
            <Input {...form.register("vatNumber")} placeholder="e.g. 15487920" />
          </div>
          <div className="flex items-center gap-3 sm:col-span-2 py-2">
            <Switch
              id="vat-registered"
              checked={form.watch("vatRegistered")}
              onCheckedChange={(c) => form.setValue("vatRegistered", c)}
            />
            <Label htmlFor="vat-registered" className="cursor-pointer">
              Enterprise is registered for 15% Ethiopian Value Added Tax (VAT)
            </Label>
          </div>
          <div className="space-y-1.5">
            <Label>Contact phone *</Label>
            <Input {...form.register("phone")} />
          </div>
          <div className="space-y-1.5">
            <Label>Contact email *</Label>
            <Input type="email" {...form.register("email")} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Registered head office address *</Label>
            <Input {...form.register("address")} />
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={updateMut.isPending}>
            {updateMut.isPending ? "Saving changes…" : "Save company settings"}
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}

/* ======================== Tax Tab ======================== */

function TaxSettingsTab() {
  const qc = useQueryClient();
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<TaxCategory | null>(null);

  const categories = useQuery({
    queryKey: ["tax-categories"],
    queryFn: () => taxService.getCategories(),
  });

  const config = taxService.getConfiguration();
  const [pricesIncludeTax, setPricesIncludeTax] = useState(config.pricesIncludeTax);

  const updateConfigMut = useMutation({
    mutationFn: (include: boolean) => taxService.updateConfiguration({ pricesIncludeTax: include }),
    onSuccess: () => {
      toast.success("Tax calculation configuration updated.");
    },
  });

  return (
    <div className="space-y-6">
      <SectionCard
        title="Tax Categories"
        description="Centralized tax configuration. Ethiopian VAT (15%), TOT (2%) and exempt categories."
        actions={
          <Button
            size="sm"
            onClick={() => {
              setEditingCat(null);
              setCatModalOpen(true);
            }}
          >
            <Plus className="mr-2 size-4" />
            Add category
          </Button>
        }
      >
        <div className="divide-y divide-border">
          {(categories.data ?? []).map((cat) => (
            <div key={cat.id} className="flex items-center justify-between py-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{cat.name}</span>
                  <span className="num font-bold text-xs bg-muted px-2 py-0.5 rounded">
                    {(cat.rate * 100).toFixed(0)}%
                  </span>
                  <span className="text-xs text-muted-foreground">Code: {cat.code}</span>
                  {cat.isDefault && (
                    <span className="text-[10px] uppercase font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                      Default
                    </span>
                  )}
                </div>
                {cat.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditingCat(cat);
                  setCatModalOpen(true);
                }}
              >
                Edit
              </Button>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Pricing & Calculation Behavior"
        description="How taxes are calculated at Point of Sale and in quotation/invoice totals."
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="prices-include-tax" className="text-sm font-medium">
                Catalog prices include tax
              </Label>
              <p className="text-xs text-muted-foreground">
                When enabled, catalog retail prices are considered gross inclusive of VAT.
              </p>
            </div>
            <Switch
              id="prices-include-tax"
              checked={pricesIncludeTax}
              onCheckedChange={(v) => {
                setPricesIncludeTax(v);
                updateConfigMut.mutate(v);
              }}
            />
          </div>
        </div>
      </SectionCard>

      {catModalOpen && (
        <TaxCategoryModal
          initial={editingCat}
          onClose={() => setCatModalOpen(false)}
          onSaved={() => {
            void qc.invalidateQueries({ queryKey: ["tax-categories"] });
            setCatModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

function TaxCategoryModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: TaxCategory | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [rate, setRate] = useState(String((initial?.rate ?? 0.15) * 100));
  const [description, setDescription] = useState(initial?.description ?? "");
  const [isDefault, setIsDefault] = useState(initial?.isDefault ?? false);

  const saveMut = useMutation({
    mutationFn: () =>
      taxService.saveCategory({
        id: initial?.id,
        name,
        code,
        rate: parseFloat(rate) / 100,
        description,
        isDefault,
        active: true,
      }),
    onSuccess: () => {
      toast.success(initial ? "Tax category updated." : "Tax category created.");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? `Edit ${initial.name}` : "New tax category"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Category name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Standard VAT"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Tax Code *</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. VAT-15"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Rate (%) *</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Applicability notes"
            />
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Switch
              id="cat-default"
              checked={isDefault}
              onCheckedChange={setIsDefault}
            />
            <Label htmlFor="cat-default" className="text-sm">
              Use as default tax category for new products
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => saveMut.mutate()}
            disabled={!name.trim() || !code.trim() || saveMut.isPending}
          >
            {saveMut.isPending ? "Saving…" : initial ? "Save changes" : "Create category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ======================== Documents Tab ======================== */

function DocumentSettingsTab() {
  const [quotationPrefix, setQuotationPrefix] = useState("QTN-");
  const [orderPrefix, setOrderPrefix] = useState("SO-");
  const [invoicePrefix, setInvoicePrefix] = useState("INV-");
  const [terms, setTerms] = useState("Payment is due within 15 days from issue date.");
  const [footer, setFooter] = useState("Thank you for choosing Abay Stationery. Goods once sold are not returnable without original receipt.");

  const handleSave = () => {
    toast.success("Document numbering and terms updated.");
  };

  return (
    <SectionCard
      title="Quotation & Invoice Configuration"
      description="Document prefixes, default payment terms, and printable A4 invoice footer notices."
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Quotation Prefix</Label>
            <Input value={quotationPrefix} onChange={(e) => setQuotationPrefix(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Sales Order Prefix</Label>
            <Input value={orderPrefix} onChange={(e) => setOrderPrefix(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Invoice Prefix</Label>
            <Input value={invoicePrefix} onChange={(e) => setInvoicePrefix(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Default Payment Terms</Label>
          <Textarea rows={2} value={terms} onChange={(e) => setTerms(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label>Invoice Printout Footer</Label>
          <Textarea rows={2} value={footer} onChange={(e) => setFooter(e.target.value)} />
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave}>Save document settings</Button>
        </div>
      </div>
    </SectionCard>
  );
}

/* ======================== Hardware Tab ======================== */

function HardwareSettingsTab() {
  const scannerState = barcodeScannerService.state();
  const printerState = printerService.state();
  const drawerState = cashDrawerService.state();

  const handleTestPrint = async () => {
    try {
      await printerService.printReceipt("root");
      toast.success("Test print window opened.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Print error");
    }
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="POS Peripherals & Hardware Adapters"
        description="Declared hardware interfaces for counter registers. No raw driver installation required."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Barcode Scanner */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ScanBarcode className="size-5 text-primary" />
              <p className="font-semibold text-sm">{scannerState.name}</p>
            </div>
            <div className="text-xs text-muted-foreground">{scannerState.detail}</div>
            <div className="flex items-center justify-between pt-2">
              <StatusBadge status={scannerState.status} />
              <span className="text-[11px] font-mono text-muted-foreground">
                {scannerState.transport}
              </span>
            </div>
          </div>

          {/* Receipt Printer */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Receipt className="size-5 text-primary" />
              <p className="font-semibold text-sm">{printerState.name}</p>
            </div>
            <div className="text-xs text-muted-foreground">{printerState.detail}</div>
            <div className="flex items-center justify-between pt-2">
              <StatusBadge status={printerState.status} />
              <Button size="sm" variant="outline" onClick={handleTestPrint}>
                <Printer className="mr-1 size-3.5" />
                Test print
              </Button>
            </div>
          </div>

          {/* Cash Drawer */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Cpu className="size-5 text-muted-foreground" />
              <p className="font-semibold text-sm">{drawerState.name}</p>
            </div>
            <div className="text-xs text-muted-foreground">{drawerState.detail}</div>
            <div className="flex items-center justify-between pt-2">
              <StatusBadge status={drawerState.status} />
              <Button
                size="sm"
                variant="outline"
                disabled
                title="Requires physical serial bridge"
              >
                Test kick
              </Button>
            </div>
          </div>
        </div>
      </SectionCard>

      <PlannedFeatureNotice
        title="Physical Device Bridge"
        description="ESC/POS thermal printer direct connection via WebUSB/WebSerial and automatic cash drawer kick are planned for the native Electron/Desktop packaging."
        status="Planned Phase 3"
      />
    </div>
  );
}

/* ======================== Features Tab ======================== */

function FeaturesSettingsTab() {
  const qc = useQueryClient();
  const [resetting, setResetting] = useState(false);
  const [selectiveDialogOpen, setSelectiveDialogOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<{
    products: boolean;
    sales: boolean;
    invoices: boolean;
    purchases: boolean;
    inventory: boolean;
    customers: boolean;
    suppliers: boolean;
    expenses: boolean;
  }>({
    products: false,
    sales: true,
    invoices: true,
    purchases: false,
    inventory: false,
    customers: false,
    suppliers: false,
    expenses: false,
  });

  const handleSelectiveReset = () => {
    const countSelected = Object.values(selectedCategories).filter(Boolean).length;
    if (countSelected === 0) {
      toast.error("Please select at least one data category to delete.");
      return;
    }
    setResetting(true);
    resetDataCategories(selectedCategories);
    void qc.invalidateQueries();
    toast.success("Selected data has been deleted.");
    setSelectiveDialogOpen(false);
    setTimeout(() => {
      setResetting(false);
      window.location.reload();
    }, 600);
  };

  const handleFactoryReset = () => {
    if (!window.confirm("Are you sure you want to reset the entire database to original factory seed data? All custom transactions, products, and modifications will be reset.")) {
      return;
    }
    setResetting(true);
    resetDatabase();
    void qc.invalidateQueries();
    toast.success("Database completely reset to initial seed state.");
    setTimeout(() => {
      setResetting(false);
      window.location.reload();
    }, 600);
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Platform Feature Registry & Roadmap"
        description="Declared modules and architecture readiness status. Modules that require external APIs or backend infrastructure remain disabled until connected."
      >
        <div className="divide-y divide-border">
          {FEATURE_LIST.map((feat) => (
            <div
              key={feat.key}
              className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm">{feat.name}</p>
                  <StatusBadge status={feat.enabled ? "Active" : feat.status} />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{feat.description}</p>
              </div>
              <div className="shrink-0">
                <Switch checked={feat.enabled} disabled aria-label={feat.name} />
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Selective Data Management & Reset"
        description="Cleanly delete specific datasets (sales orders, invoices, stock, or products) without affecting other operations."
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
            <div>
              <p className="text-sm font-semibold">Granular Data Deletion</p>
              <p className="text-xs text-muted-foreground">
                Choose exactly what to delete: clear only sales records, only invoices/payments, only products, only inventory, or any combination.
              </p>
            </div>
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive shrink-0"
              onClick={() => setSelectiveDialogOpen(true)}
              disabled={resetting}
            >
              <Trash2 className="mr-2 size-3.5" />
              Selective Reset Options...
            </Button>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-1">
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Factory Database Reset</p>
              <p className="text-xs text-muted-foreground">
                Re-initializes all tables to factory default state.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive shrink-0"
              onClick={handleFactoryReset}
              disabled={resetting}
            >
              <RotateCcw className="mr-2 size-3.5" />
              {resetting ? "Resetting…" : "Reset All to Factory Defaults"}
            </Button>
          </div>
        </div>
      </SectionCard>

      {/* Selective Reset Dialog */}
      <Dialog open={selectiveDialogOpen} onOpenChange={setSelectiveDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" /> Delete Specific Data
            </DialogTitle>
            <DialogDescription>
              Select the data categories you want to delete. Unchecked categories will remain untouched.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card/50 hover:bg-accent/40 cursor-pointer transition-colors">
                <Checkbox
                  checked={selectedCategories.sales}
                  onCheckedChange={(c) => setSelectedCategories((prev) => ({ ...prev, sales: !!c }))}
                />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium leading-none">Sales Records</p>
                  <p className="text-xs text-muted-foreground">POS sales, orders, quotes & returns</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card/50 hover:bg-accent/40 cursor-pointer transition-colors">
                <Checkbox
                  checked={selectedCategories.invoices}
                  onCheckedChange={(c) => setSelectedCategories((prev) => ({ ...prev, invoices: !!c }))}
                />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium leading-none">Invoices & Payments</p>
                  <p className="text-xs text-muted-foreground">Customer invoices & payment logs</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card/50 hover:bg-accent/40 cursor-pointer transition-colors">
                <Checkbox
                  checked={selectedCategories.products}
                  onCheckedChange={(c) => setSelectedCategories((prev) => ({ ...prev, products: !!c }))}
                />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium leading-none">Products Catalog</p>
                  <p className="text-xs text-muted-foreground">All items, SKUs and barcodes</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card/50 hover:bg-accent/40 cursor-pointer transition-colors">
                <Checkbox
                  checked={selectedCategories.inventory}
                  onCheckedChange={(c) => setSelectedCategories((prev) => ({ ...prev, inventory: !!c }))}
                />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium leading-none">Stock Balances & Ledger</p>
                  <p className="text-xs text-muted-foreground">Zero out stock, clear transfers</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card/50 hover:bg-accent/40 cursor-pointer transition-colors">
                <Checkbox
                  checked={selectedCategories.purchases}
                  onCheckedChange={(c) => setSelectedCategories((prev) => ({ ...prev, purchases: !!c }))}
                />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium leading-none">Purchasing Data</p>
                  <p className="text-xs text-muted-foreground">Purchase orders & goods receipts</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card/50 hover:bg-accent/40 cursor-pointer transition-colors">
                <Checkbox
                  checked={selectedCategories.customers}
                  onCheckedChange={(c) => setSelectedCategories((prev) => ({ ...prev, customers: !!c }))}
                />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium leading-none">Customers</p>
                  <p className="text-xs text-muted-foreground">Client directories and records</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card/50 hover:bg-accent/40 cursor-pointer transition-colors">
                <Checkbox
                  checked={selectedCategories.suppliers}
                  onCheckedChange={(c) => setSelectedCategories((prev) => ({ ...prev, suppliers: !!c }))}
                />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium leading-none">Suppliers</p>
                  <p className="text-xs text-muted-foreground">Supplier accounts & directories</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card/50 hover:bg-accent/40 cursor-pointer transition-colors">
                <Checkbox
                  checked={selectedCategories.expenses}
                  onCheckedChange={(c) => setSelectedCategories((prev) => ({ ...prev, expenses: !!c }))}
                />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium leading-none">Expenses</p>
                  <p className="text-xs text-muted-foreground">Recorded operational costs</p>
                </div>
              </label>
            </div>

            <div className="flex justify-between items-center pt-2 text-xs text-muted-foreground">
              <button
                type="button"
                className="underline hover:text-foreground"
                onClick={() =>
                  setSelectedCategories({
                    products: true,
                    sales: true,
                    invoices: true,
                    purchases: true,
                    inventory: true,
                    customers: true,
                    suppliers: true,
                    expenses: true,
                  })
                }
              >
                Select All
              </button>
              <button
                type="button"
                className="underline hover:text-foreground"
                onClick={() =>
                  setSelectedCategories({
                    products: false,
                    sales: false,
                    invoices: false,
                    purchases: false,
                    inventory: false,
                    customers: false,
                    suppliers: false,
                    expenses: false,
                  })
                }
              >
                Deselect All
              </button>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setSelectiveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleSelectiveReset}
              disabled={resetting || Object.values(selectedCategories).every((v) => !v)}
            >
              <Trash2 className="mr-2 size-4" />
              {resetting ? "Deleting..." : "Delete Selected Data"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
