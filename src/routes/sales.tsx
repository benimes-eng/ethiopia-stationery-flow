import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { AppLayout } from "@/components/app/app-layout";
import {
  CurrencyDisplay,
  DateDisplay,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from "@/components/app/primitives";
import { DataTable, FilterBar, FilterSelect, SearchInput, type Column } from "@/components/app/data-table";
import { ReceiptPreview } from "@/components/app/document-preview";
import { LocationSelect } from "@/components/app/selectors";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSession } from "@/hooks/use-session";
import { salesService } from "@/services/sales.service";
import { catalogService } from "@/services/catalog.service";
import { financeService } from "@/services/finance.service";
import { taxService } from "@/services/tax.service";
import { printerService } from "@/services/hardware.service";
import { formatCurrency } from "@/lib/format";
import type { Sale } from "@/domain/types";

export const Route = createFileRoute("/sales")({
  head: () => ({
    meta: [
      { title: "Sales history — Abay Stationery Management" },
      {
        name: "description",
        content:
          "Search completed, held and returned sales by branch, review line detail and reprint receipts.",
      },
      { property: "og:title", content: "Sales history — Abay Stationery Management" },
      {
        property: "og:description",
        content: "Every register transaction with tax totals, cashier and payment detail.",
      },
    ],
  }),
  component: SalesRoute,
});

function SalesRoute() {
  return (
    <AppLayout permission="sales.view">
      <SalesHistory />
    </AppLayout>
  );
}

function SalesHistory() {
  const { branchId } = useSession();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | Sale["status"]>("all");
  const [location, setLocation] = useState<string>(branchId === "all" ? "all" : branchId);
  const [selected, setSelected] = useState<Sale | null>(null);

  const sales = useQuery({
    queryKey: ["sales", search, status, location],
    queryFn: () =>
      salesService.listSales({
        search,
        status,
        branchId: location === "all" ? "all" : location,
      }),
  });

  const rows = sales.data ?? [];
  const users = catalogService.users();
  const customers = catalogService.customers();
  const branches = catalogService.branches();
  const payments = financeService.payments();

  const summary = useMemo(() => {
    const completed = rows.filter((s) => s.status === "completed");
    const total = completed.reduce((sum, s) => sum + taxService.computeDocument(s.lines).total, 0);
    return {
      total,
      count: completed.length,
      average: completed.length ? total / completed.length : 0,
    };
  }, [rows]);

  const columns: Array<Column<Sale>> = [
    {
      key: "number",
      header: "Number",
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
      key: "customer",
      header: "Customer",
      render: (row) => customers.find((c) => c.id === row.customerId)?.name ?? "Walk-in",
      hideOnMobile: true,
    },
    {
      key: "cashier",
      header: "Cashier",
      render: (row) => users.find((u) => u.id === row.cashierId)?.name ?? "—",
      hideOnMobile: true,
    },
    {
      key: "channel",
      header: "Channel",
      render: (row) => <StatusBadge status={row.channel === "wholesale" ? "Sent" : "Approved"} />,
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
  ];

  const payment = selected ? payments.find((p) => p.saleId === selected.id) : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales"
        description="Every register transaction, including held carts and returned sales."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Completed sales" value={String(summary.count)} loading={sales.isLoading} />
        <StatCard
          label="Value invoiced"
          value={formatCurrency(summary.total)}
          loading={sales.isLoading}
        />
        <StatCard
          label="Average basket"
          value={formatCurrency(summary.average)}
          loading={sales.isLoading}
        />
      </div>

      <SectionCard contentClassName="p-0">
        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder="Search by sale number" />
          <FilterSelect
            label="Status"
            value={status}
            onChange={(value) => setStatus(value as typeof status)}
            options={[
              { value: "all", label: "All statuses" },
              { value: "completed", label: "Completed" },
              { value: "held", label: "Held" },
              { value: "returned", label: "Returned" },
            ]}
          />
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Location</span>
            <LocationSelect value={location} onChange={setLocation} includeAll kind="branch" />
          </div>
        </FilterBar>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          loading={sales.isLoading}
          error={sales.error}
          onRetry={() => void sales.refetch()}
          onRowClick={(row) => setSelected(row)}
          pageSize={12}
          caption="Sales history"
          empty={{
            title: "No sales match these filters",
            description: "Adjust the search, status or branch filter.",
          }}
        />
      </SectionCard>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selected?.number}</DialogTitle>
            <DialogDescription>
              Receipt copy. Reprints are logged as duplicates, not fiscal documents.
            </DialogDescription>
          </DialogHeader>
          {selected ? (
            <ReceiptPreview
              elementId="sales-receipt-print"
              number={selected.number}
              createdAt={selected.createdAt}
              branchId={selected.branchId}
              cashierName={users.find((u) => u.id === selected.cashierId)?.name ?? ""}
              customerName={customers.find((c) => c.id === selected.customerId)?.name}
              lines={selected.lines}
              payment={
                payment
                  ? {
                      method: payment.method,
                      amount: payment.amount,
                      bank: payment.bank,
                      reference: payment.reference,
                    }
                  : undefined
              }
            />
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => void printerService.printReceipt("sales-receipt-print")}
            >
              <Printer className="mr-2 size-4" /> Print copy
            </Button>
            <Button onClick={() => setSelected(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
