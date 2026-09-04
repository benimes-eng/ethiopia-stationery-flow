import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  Receipt,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppLayout } from "@/components/app/app-layout";
import {
  ChartCard,
  CurrencyDisplay,
  DateDisplay,
  EmptyState,
  LoadingState,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/use-session";
import { defaultRange, reportService } from "@/services/report.service";
import { inventoryService } from "@/services/inventory.service";
import { salesService } from "@/services/sales.service";
import { purchasingService } from "@/services/purchasing.service";
import { documentsService } from "@/services/documents.service";
import { catalogService } from "@/services/catalog.service";
import { formatCurrency, formatDate, formatPercent, formatQuantity } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Operations dashboard — Abay Stationery Management" },
      {
        name: "description",
        content:
          "Daily sales, gross profit, stock value and reorder alerts across every Abay Stationery branch and warehouse.",
      },
      { property: "og:title", content: "Operations dashboard — Abay Stationery Management" },
      {
        property: "og:description",
        content: "Live KPIs, sales trends and stock alerts for Ethiopian stationery operations.",
      },
    ],
  }),
  component: DashboardRoute,
});

function DashboardRoute() {
  return (
    <AppLayout permission="dashboard.view">
      <Dashboard />
    </AppLayout>
  );
}

function Dashboard() {
  const { user, branchId, can } = useSession();
  const range = useMemo(() => defaultRange(30, branchId), [branchId]);

  const kpis = useQuery({ queryKey: ["kpis", range], queryFn: () => reportService.kpis(range) });
  const trend = useQuery({
    queryKey: ["sales-trend", range],
    queryFn: () => reportService.salesTrend(range),
  });
  const byBranch = useQuery({
    queryKey: ["sales-branch", range],
    queryFn: () => reportService.salesByBranch(range),
  });
  const recent = useQuery({
    queryKey: ["recent-sales", branchId],
    queryFn: () => salesService.listSales({ branchId, status: "completed" }),
  });
  const lowStock = useQuery({
    queryKey: ["low-stock", branchId],
    queryFn: () => inventoryService.lowStock(branchId, 8),
  });
  const approvals = useQuery({
    queryKey: ["pending-approvals"],
    queryFn: async () => ({
      purchaseOrders: (await purchasingService.listOrders({ status: "Pending Approval" })).length,
      quotations: (await documentsService.listQuotations({ status: "Sent" })).length,
      transfers: (await inventoryService.listTransfers()).filter((t) => t.status === "Requested")
        .length,
      counts: (await inventoryService.listCounts()).filter((c) => c.status === "Pending Approval")
        .length,
    }),
  });

  const customers = catalogService.customers();
  const branches = catalogService.branches();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Good day, ${user?.name.split(" ")[0] ?? "there"}`}
        description={`Performance for the last 30 days (${formatDate(range.from)} – ${formatDate(range.to)}) across ${
          branchId === "all" ? "all locations" : branches.find((b) => b.id === branchId)?.name ?? "your branch"
        }.`}
        actions={
          <>
            {can("pos.access") ? (
              <Button asChild>
                <Link to="/pos">
                  <ShoppingCart className="mr-2 size-4" /> Open register
                </Link>
              </Button>
            ) : null}
            {can("reports.sales") ? (
              <Button variant="outline" asChild>
                <Link to="/reports">
                  View reports <ArrowUpRight className="ml-2 size-4" />
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Sales today"
          value={formatCurrency(kpis.data?.todaySales ?? 0)}
          hint={`${formatQuantity(kpis.data?.todayTransactions ?? 0)} transactions`}
          icon={<Receipt className="size-4" />}
          loading={kpis.isLoading}
        />
        <StatCard
          label="Sales (30 days)"
          value={formatCurrency(kpis.data?.periodSales ?? 0)}
          hint={`${formatQuantity(kpis.data?.transactions ?? 0)} transactions`}
          icon={<TrendingUp className="size-4" />}
          loading={kpis.isLoading}
        />
        <StatCard
          label="Gross profit"
          value={formatCurrency(kpis.data?.grossProfit ?? 0)}
          hint={`Margin ${formatPercent(kpis.data?.grossMargin ?? 0)}`}
          tone="positive"
          icon={<TrendingUp className="size-4" />}
          loading={kpis.isLoading}
        />
        <StatCard
          label="Stock at cost"
          value={formatCurrency(kpis.data?.inventoryValue ?? 0)}
          hint={`${formatQuantity(kpis.data?.lowStock ?? 0)} items at or below reorder level`}
          tone={(kpis.data?.lowStock ?? 0) > 0 ? "warning" : "default"}
          icon={<Boxes className="size-4" />}
          loading={kpis.isLoading}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard
          title="Daily sales"
          description="Total invoiced value per day, including tax."
          className="xl:col-span-2"
        >
          {trend.isLoading ? (
            <LoadingState rows={4} />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend.data ?? []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value: string) => value.slice(5)}
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                />
                <YAxis
                  tickFormatter={(value: number) => formatCurrency(value, { compact: true, symbol: false })}
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  width={60}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  labelFormatter={(label: string) => formatDate(label)}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Sales by branch" description="Last 30 days.">
          {byBranch.isLoading ? (
            <LoadingState rows={4} />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byBranch.data ?? []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="branch" tickLine={false} axisLine={false} fontSize={10} />
                <YAxis
                  tickFormatter={(value: number) => formatCurrency(value, { compact: true, symbol: false })}
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  width={60}
                />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard
          title="Recent sales"
          description="Latest completed register transactions."
          className="xl:col-span-2"
          contentClassName="p-0"
          actions={
            can("sales.view") ? (
              <Button variant="ghost" size="sm" asChild>
                <Link to="/sales">All sales</Link>
              </Button>
            ) : null
          }
        >
          {recent.isLoading ? (
            <LoadingState rows={5} />
          ) : (recent.data ?? []).length === 0 ? (
            <EmptyState title="No sales yet" description="Completed sales will appear here." />
          ) : (
            <ul className="divide-y divide-border">
              {(recent.data ?? []).slice(0, 6).map((sale) => {
                const totals = reportService.saleTotals(sale.lines);
                const customer = customers.find((c) => c.id === sale.customerId);
                return (
                  <li
                    key={sale.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="num text-sm font-medium">{sale.number}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {customer?.name ?? "Walk-in customer"} ·{" "}
                        {branches.find((b) => b.id === sale.branchId)?.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="hidden text-xs text-muted-foreground sm:block">
                        <DateDisplay value={sale.createdAt} withTime />
                      </span>
                      <StatusBadge status={sale.channel === "wholesale" ? "Sent" : "completed"} />
                      <CurrencyDisplay value={totals.total} className="text-sm font-semibold" />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        <div className="space-y-4">
          <SectionCard title="Needs attention" contentClassName="p-0">
            <ul className="divide-y divide-border text-sm">
              <AttentionRow
                label="Purchase orders awaiting approval"
                value={approvals.data?.purchaseOrders ?? 0}
                to="/purchasing"
              />
              <AttentionRow
                label="Quotations awaiting a decision"
                value={approvals.data?.quotations ?? 0}
                to="/quotations"
              />
              <AttentionRow
                label="Transfer requests"
                value={approvals.data?.transfers ?? 0}
                to="/inventory"
              />
              <AttentionRow
                label="Stock counts to approve"
                value={approvals.data?.counts ?? 0}
                to="/inventory"
              />
            </ul>
          </SectionCard>

          <SectionCard
            title="Reorder alerts"
            description="Items at or below their reorder level."
            contentClassName="p-0"
          >
            {lowStock.isLoading ? (
              <LoadingState rows={4} />
            ) : (lowStock.data ?? []).length === 0 ? (
              <EmptyState title="Stock levels are healthy" />
            ) : (
              <ul className="divide-y divide-border">
                {(lowStock.data ?? []).map((row) => (
                  <li
                    key={`${row.product.id}-${row.locationId}`}
                    className="flex items-center justify-between gap-3 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{row.product.name}</p>
                      <p className="num text-xs text-muted-foreground">
                        {row.product.sku} · reorder at {formatQuantity(row.product.reorderLevel)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="num text-sm">{formatQuantity(row.quantity)}</span>
                      <StatusBadge status={row.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function AttentionRow({
  label,
  value,
  to,
}: {
  label: string;
  value: number;
  to: "/purchasing" | "/quotations" | "/inventory";
}) {
  return (
    <li className="flex items-center justify-between gap-3 px-5 py-3">
      <span className="flex items-center gap-2">
        {value > 0 ? <AlertTriangle className="size-3.5 text-warning" /> : null}
        <Link to={to} className="hover:underline">
          {label}
        </Link>
      </span>
      <span className="num font-semibold">{formatQuantity(value)}</span>
    </li>
  );
}
