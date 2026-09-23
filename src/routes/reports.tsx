import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { Download, TrendingDown, TrendingUp } from "lucide-react";
import { AppLayout } from "@/components/app/app-layout";
import {
  CurrencyDisplay,
  DateDisplay,
  LoadingState,
  PageHeader,
  SectionCard,
  StatCard,
} from "@/components/app/primitives";
import { DataTable, type Column } from "@/components/app/data-table";
import { LocationSelect } from "@/components/app/selectors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/hooks/use-session";
import { reportService, defaultRange, exportToCsv, type ReportRange } from "@/services/report.service";
import { formatCurrency, formatDate, formatPercent, formatQuantity } from "@/lib/format";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Stationery Management" },
      {
        name: "description",
        content:
          "Sales performance, stock movement, purchase analysis, profitability and tax reports.",
      },
    ],
  }),
  component: ReportsRoute,
});

function ReportsRoute() {
  return (
    <AppLayout permission="reports.sales">
      <ReportsDashboard />
    </AppLayout>
  );
}

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function ReportsDashboard() {
  const { branchId, can } = useSession();
  const today = new Date().toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(today);
  const [location, setLocation] = useState(branchId === "all" ? "all" : branchId);
  const [activeTab, setActiveTab] = useState("sales");

  const range: ReportRange = useMemo(
    () => ({ from: fromDate, to: toDate, branchId: location }),
    [fromDate, toDate, location],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Operational reporting across sales, stock, purchasing, profitability and tax."
      />

      {/* Range and location controls */}
      <SectionCard>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label>From</Label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="space-y-1.5">
            <Label>To</Label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Location</Label>
            <LocationSelect value={location} onChange={setLocation} includeAll />
          </div>
          <div className="flex gap-2">
            {(["7", "30", "90"] as const).map((days) => (
              <Button
                key={days}
                size="sm"
                variant="outline"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() - Number(days));
                  setFromDate(d.toISOString().slice(0, 10));
                  setToDate(today);
                }}
              >
                {days}d
              </Button>
            ))}
          </div>
        </div>
      </SectionCard>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="sales">Sales</TabsTrigger>
          {can("reports.profit") && <TabsTrigger value="profit">Profitability</TabsTrigger>}
          {can("reports.purchase") && <TabsTrigger value="purchase">Purchasing</TabsTrigger>}
          {can("reports.inventory") && <TabsTrigger value="inventory">Stock</TabsTrigger>}
          {can("reports.tax") && <TabsTrigger value="tax">Tax</TabsTrigger>}
        </TabsList>

        <TabsContent value="sales" className="mt-4">
          <SalesReport range={range} />
        </TabsContent>

        {can("reports.profit") && (
          <TabsContent value="profit" className="mt-4">
            <ProfitReport range={range} />
          </TabsContent>
        )}

        {can("reports.purchase") && (
          <TabsContent value="purchase" className="mt-4">
            <PurchaseReport range={range} />
          </TabsContent>
        )}

        {can("reports.inventory") && (
          <TabsContent value="inventory" className="mt-4">
            <StockReport range={range} />
          </TabsContent>
        )}

        {can("reports.tax") && (
          <TabsContent value="tax" className="mt-4">
            <TaxReport range={range} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

/* ======================== Sales Report ======================== */

function SalesReport({ range }: { range: ReportRange }) {
  const kpis = useQuery({ queryKey: ["report-kpis", range], queryFn: () => reportService.kpis(range) });
  const trend = useQuery({ queryKey: ["report-trend", range], queryFn: () => reportService.salesTrend(range) });
  const byBranch = useQuery({ queryKey: ["report-branch", range], queryFn: () => reportService.salesByBranch(range) });
  const byCategory = useQuery({ queryKey: ["report-category", range], queryFn: () => reportService.salesByCategory(range) });
  const byCashier = useQuery({ queryKey: ["report-cashier", range], queryFn: () => reportService.salesByCashier(range) });
  const topProducts = useQuery({ queryKey: ["report-top-products", range], queryFn: () => reportService.topProducts(range, 10) });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Sales (period)" value={formatCurrency(kpis.data?.periodSales ?? 0)} loading={kpis.isLoading} />
        <StatCard label="Transactions" value={formatQuantity(kpis.data?.transactions ?? 0)} loading={kpis.isLoading} />
        <StatCard label="Gross profit" value={formatCurrency(kpis.data?.grossProfit ?? 0)} tone="positive" loading={kpis.isLoading} />
        <StatCard
          label="Gross margin"
          value={formatPercent(kpis.data?.grossMargin ?? 0)}
          tone={(kpis.data?.grossMargin ?? 0) > 0.15 ? "positive" : "warning"}
          loading={kpis.isLoading}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard
          title="Daily sales trend"
          description={`${formatDate(range.from)} – ${formatDate(range.to)}`}
          className="xl:col-span-2"
        >
          <div className="h-64">
            {trend.isLoading ? (
              <LoadingState rows={4} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend.data ?? []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v: string) => v.slice(5)}
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                  />
                  <YAxis
                    tickFormatter={(v: number) => formatCurrency(v, { compact: true, symbol: false })}
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    width={60}
                  />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} labelFormatter={(l: string) => formatDate(l)} />
                  <Line type="monotone" dataKey="total" stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Sales by branch">
          <div className="h-64">
            {byBranch.isLoading ? (
              <LoadingState rows={4} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byBranch.data ?? []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="branch" tickLine={false} axisLine={false} fontSize={10} />
                  <YAxis tickFormatter={(v: number) => formatCurrency(v, { compact: true, symbol: false })} tickLine={false} axisLine={false} fontSize={11} width={60} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="total" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Top products by revenue">
          <DataTable
            columns={[
              { key: "name", header: "Product", render: (row) => <span className="font-medium">{row.name}</span> },
              { key: "qty", header: "Qty sold", align: "right", render: (row) => <span className="num">{formatQuantity(row.qty)}</span> },
              { key: "revenue", header: "Revenue", align: "right", render: (row) => <CurrencyDisplay value={row.revenue} className="font-medium" /> },
            ]}
            rows={topProducts.data ?? []}
            rowKey={(row) => row.productId}
            loading={topProducts.isLoading}
            pageSize={10}
            caption="Top products"
            empty={{ title: "No sales data", description: "Adjust the date range." }}
          />
        </SectionCard>

        <SectionCard title="Sales by category">
          <div className="h-64">
            {byCategory.isLoading ? (
              <LoadingState rows={4} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byCategory.data ?? []}
                    dataKey="total"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ category, percent }) => `${category as string} ${((percent as number) * 100).toFixed(0)}%`}
                    labelLine={false}
                    fontSize={11}
                  >
                    {(byCategory.data ?? []).map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Sales by cashier"
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              exportToCsv("cashier_report.csv", byCashier.data?.map((r) => ({
                cashier: r.cashier,
                transactions: r.transactions,
                total: r.total,
              })) ?? [])
            }
          >
            <Download className="mr-2 size-4" />
            Export CSV
          </Button>
        }
      >
        <DataTable
          columns={[
            { key: "cashier", header: "Cashier", render: (row) => <span className="font-medium">{row.cashier}</span> },
            { key: "transactions", header: "Transactions", align: "right", render: (row) => <span className="num">{formatQuantity(row.transactions)}</span> },
            { key: "total", header: "Total sales", align: "right", render: (row) => <CurrencyDisplay value={row.total} className="font-medium" /> },
          ]}
          rows={byCashier.data ?? []}
          rowKey={(row) => row.cashier}
          loading={byCashier.isLoading}
          pageSize={10}
          caption="Sales by cashier"
          empty={{ title: "No cashier data", description: "Adjust the date range." }}
        />
      </SectionCard>
    </div>
  );
}

/* ======================== Profitability Report ======================== */

function ProfitReport({ range }: { range: ReportRange }) {
  const profit = useQuery({
    queryKey: ["report-profit", range],
    queryFn: () => reportService.profitability(range),
  });

  const d = profit.data;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Gross sales" value={formatCurrency(d?.gross ?? 0)} loading={profit.isLoading} />
        <StatCard label="Discounts given" value={formatCurrency(d?.discounts ?? 0)} loading={profit.isLoading} />
        <StatCard label="Net sales" value={formatCurrency(d?.net ?? 0)} loading={profit.isLoading} />
        <StatCard label="Cost of goods sold" value={formatCurrency(d?.cogs ?? 0)} loading={profit.isLoading} />
        <StatCard
          label="Gross profit"
          value={formatCurrency(d?.grossProfit ?? 0)}
          tone={(d?.grossProfit ?? 0) > 0 ? "positive" : "negative"}
          hint={`Margin ${formatPercent(d?.grossMargin ?? 0)}`}
          loading={profit.isLoading}
        />
        <StatCard label="Operating expenses" value={formatCurrency(d?.expenses ?? 0)} loading={profit.isLoading} />
      </div>

      <SectionCard title="Operating profit">
        <div className="flex items-center gap-4">
          {(d?.operatingProfit ?? 0) >= 0 ? (
            <TrendingUp className="size-8 text-emerald-600" />
          ) : (
            <TrendingDown className="size-8 text-destructive" />
          )}
          <div>
            <p className="text-3xl font-bold num">
              {formatCurrency(d?.operatingProfit ?? 0)}
            </p>
            <p className="text-sm text-muted-foreground">
              Net sales minus COGS minus operating expenses
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard>
        <div className="rounded-md border border-amber-100 bg-amber-50 p-4 text-sm text-amber-700">
          <p className="font-medium">Profitability notes</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            <li>COGS uses the product cost field, not the weighted-average cost from the inventory ledger — this is a Cursor task.</li>
            <li>Operating expenses include only records entered on the Expenses screen for this period and location.</li>
            <li>Depreciation, payroll taxes and other accruals are not included — this requires backend accounting integration.</li>
          </ul>
        </div>
      </SectionCard>
    </div>
  );
}

/* ======================== Purchase Report ======================== */

function PurchaseReport({ range }: { range: ReportRange }) {
  const trend = useQuery({
    queryKey: ["report-purchase-trend", range],
    queryFn: () => reportService.purchaseTrend(range),
  });
  const bySupplier = useQuery({
    queryKey: ["report-purchase-supplier", range],
    queryFn: () => reportService.purchasesBySupplier(range),
  });

  return (
    <div className="space-y-6">
      <SectionCard title="Monthly purchase value" description="Total goods received, by month.">
        <div className="h-64">
          {trend.isLoading ? (
            <LoadingState rows={4} />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend.data ?? []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis
                  tickFormatter={(v: number) => formatCurrency(v, { compact: true, symbol: false })}
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  width={60}
                />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="total" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} name="Purchase value" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Purchases by supplier"
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              exportToCsv("supplier_purchases.csv", bySupplier.data?.map((r) => ({
                supplier: r.supplier,
                orders: r.orders,
                total: r.total,
              })) ?? [])
            }
          >
            <Download className="mr-2 size-4" />
            Export CSV
          </Button>
        }
      >
        <DataTable
          columns={[
            { key: "supplier", header: "Supplier", render: (row) => <span className="font-medium">{row.supplier}</span> },
            { key: "orders", header: "Orders", align: "right", render: (row) => <span className="num">{row.orders}</span> },
            { key: "total", header: "Total value", align: "right", render: (row) => <CurrencyDisplay value={row.total} className="font-medium" /> },
          ]}
          rows={bySupplier.data ?? []}
          rowKey={(row) => row.supplier}
          loading={bySupplier.isLoading}
          pageSize={10}
          caption="Purchases by supplier"
          empty={{ title: "No purchase data", description: "Adjust the date range." }}
        />
      </SectionCard>
    </div>
  );
}

/* ======================== Stock Report ======================== */

function StockReport({ range }: { range: ReportRange }) {
  const movements = useQuery({
    queryKey: ["report-stock", range],
    queryFn: () => reportService.stockMovementReport(range),
  });

  const products = movements.data
    ? Object.fromEntries(
        movements.data.map((t) => [t.productId, t.productId]),
      )
    : {};

  return (
    <div className="space-y-4">
      <SectionCard
        title="Stock movements"
        description={`Inventory ledger entries for ${formatDate(range.from)} – ${formatDate(range.to)}`}
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              exportToCsv("stock_movements.csv", (movements.data ?? []).map((t) => ({
                date: t.createdAt,
                product: t.productId,
                location: t.locationId,
                type: t.type,
                quantity: t.quantity,
                unit_cost: t.unitCost,
                reference: t.reference,
              })))
            }
          >
            <Download className="mr-2 size-4" />
            Export CSV
          </Button>
        }
        contentClassName="p-0"
      >
        <DataTable
          columns={[
            { key: "date", header: "Date", render: (row) => <DateDisplay value={row.createdAt} withTime /> },
            { key: "type", header: "Type", render: (row) => <span className="num rounded bg-muted px-1.5 py-0.5 text-xs font-medium">{row.type}</span> },
            { key: "product", header: "Product", render: (row) => <span className="text-sm">{row.productId}</span> },
            { key: "location", header: "Location", render: (row) => <span className="text-xs">{row.locationId}</span>, hideOnMobile: true },
            {
              key: "qty",
              header: "Qty",
              align: "right",
              render: (row) => (
                <span className={`num font-medium ${row.quantity < 0 ? "text-destructive" : "text-emerald-600"}`}>
                  {row.quantity > 0 ? "+" : ""}
                  {formatQuantity(row.quantity)}
                </span>
              ),
            },
            { key: "ref", header: "Reference", render: (row) => <span className="num text-xs text-muted-foreground">{row.reference}</span>, hideOnMobile: true },
          ]}
          rows={movements.data ?? []}
          rowKey={(row) => row.id}
          loading={movements.isLoading}
          pageSize={15}
          caption="Stock movements"
          empty={{ title: "No movements in this period", description: "Adjust the date range." }}
        />
      </SectionCard>
    </div>
  );
}

/* ======================== Tax Report ======================== */

function TaxReport({ range }: { range: ReportRange }) {
  const taxReport = useQuery({
    queryKey: ["report-tax", range],
    queryFn: () => reportService.taxReport(range),
  });

  const d = taxReport.data;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Taxable amount" value={formatCurrency(d?.taxableTotal ?? 0)} loading={taxReport.isLoading} />
        <StatCard label="Total VAT collected" value={formatCurrency(d?.taxTotal ?? 0)} loading={taxReport.isLoading} />
        <StatCard label="Invoice gross total" value={formatCurrency(d?.grandTotal ?? 0)} loading={taxReport.isLoading} />
      </div>

      <SectionCard
        title="Invoice tax breakdown"
        description="All non-cancelled invoices in the period."
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              exportToCsv("tax_report.csv", d?.rows.map((r) => ({
                invoice: r.number,
                date: r.date,
                taxable: r.taxable,
                vat: r.tax,
                total: r.total,
              })) ?? [])
            }
          >
            <Download className="mr-2 size-4" />
            Export CSV
          </Button>
        }
        contentClassName="p-0"
      >
        <DataTable
          columns={[
            { key: "number", header: "Invoice", render: (row) => <span className="num font-medium">{row.number}</span> },
            { key: "date", header: "Date", render: (row) => <DateDisplay value={row.date} /> },
            { key: "taxable", header: "Taxable", align: "right", render: (row) => <CurrencyDisplay value={row.taxable} /> },
            { key: "tax", header: "VAT", align: "right", render: (row) => <CurrencyDisplay value={row.tax} className="font-medium" /> },
            { key: "total", header: "Total", align: "right", render: (row) => <CurrencyDisplay value={row.total} className="font-semibold" /> },
          ]}
          rows={d?.rows ?? []}
          rowKey={(row) => row.id}
          loading={taxReport.isLoading}
          pageSize={15}
          caption="Tax report"
          empty={{ title: "No invoices in this period", description: "Adjust the date range." }}
        />
      </SectionCard>

      <SectionCard>
        <div className="rounded-md border border-amber-100 bg-amber-50 p-4 text-sm text-amber-700">
          <p className="font-medium">Fiscal integration notice</p>
          <p className="mt-1">
            This report is for internal reference only. Ethiopian ERCA fiscal device integration
            and e-invoice submission is declared in the platform but not yet connected. A backend
            engineer should implement the Ethiopia fiscal adapter described in{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 text-xs">fiscal.service.ts</code>.
          </p>
        </div>
      </SectionCard>
    </div>
  );
}
