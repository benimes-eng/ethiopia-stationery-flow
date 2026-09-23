import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/app/app-layout";
import {
  CurrencyDisplay,
  DateDisplay,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from "@/components/app/primitives";
import {
  DataTable,
  FilterBar,
  FilterSelect,
  SearchInput,
  type Column,
} from "@/components/app/data-table";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSession } from "@/hooks/use-session";
import { financeService } from "@/services/finance.service";
import { documentsService } from "@/services/documents.service";
import { catalogService } from "@/services/catalog.service";
import { formatCurrency } from "@/lib/format";
import type { Expense, ExpenseCategory, Payment, PaymentMethod } from "@/domain/types";

export const Route = createFileRoute("/payments")({
  head: () => ({
    meta: [{ title: "Payments & Expenses — Stationery Management" }],
  }),
  component: PaymentsRoute,
});

function PaymentsRoute() {
  return (
    <AppLayout permission="payments.view">
      <PaymentsAndExpenses />
    </AppLayout>
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

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Rent",
  "Utilities",
  "Transport",
  "Supplies",
  "Maintenance",
  "Salary",
  "Other",
];

function PaymentsAndExpenses() {
  const { can } = useSession();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("payments");
  const [expenseOpen, setExpenseOpen] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments & Expenses"
        description="Manual cash and bank payment records. No live banking or payment gateway integration is connected."
        actions={
          can("expenses.create") ? (
            <Button onClick={() => setExpenseOpen(true)}>
              <Plus className="mr-2 size-4" />
              Record expense
            </Button>
          ) : null
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="payments">Payments received</TabsTrigger>
          {can("expenses.view") && <TabsTrigger value="expenses">Expenses</TabsTrigger>}
        </TabsList>

        <TabsContent value="payments" className="mt-4">
          <PaymentsTab />
        </TabsContent>

        {can("expenses.view") && (
          <TabsContent value="expenses" className="mt-4">
            <ExpensesTab />
          </TabsContent>
        )}
      </Tabs>

      {expenseOpen && (
        <ExpenseForm
          onClose={() => setExpenseOpen(false)}
          onSaved={() => {
            void qc.invalidateQueries({ queryKey: ["expenses"] });
            setExpenseOpen(false);
          }}
        />
      )}
    </div>
  );
}

/* ======================== Payments Tab ======================== */

function PaymentsTab() {
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState<PaymentMethod | "all">("all");
  const [location, setLocation] = useState("all");

  const payments = useQuery({
    queryKey: ["payments", search, method, location],
    queryFn: () => financeService.listPayments({ method, branchId: location, search }),
  });

  const branches = catalogService.branches();
  const invoices = documentsService.invoices();
  const users = catalogService.users();

  const summary = {
    total: (payments.data ?? []).reduce((s, p) => s + p.amount, 0),
    cash: (payments.data ?? [])
      .filter((p) => p.method === "Cash")
      .reduce((s, p) => s + p.amount, 0),
    bank: (payments.data ?? [])
      .filter((p) => p.method === "Bank")
      .reduce((s, p) => s + p.amount, 0),
  };

  const columns: Array<Column<Payment>> = [
    {
      key: "number",
      header: "Payment no.",
      render: (row) => <span className="num font-medium">{row.number}</span>,
      sortValue: (row) => row.number,
    },
    {
      key: "date",
      header: "Date",
      render: (row) => <DateDisplay value={row.date} withTime />,
      sortValue: (row) => row.date,
    },
    {
      key: "invoice",
      header: "Invoice",
      render: (row) => {
        const inv = row.invoiceId ? invoices.find((i) => i.id === row.invoiceId) : null;
        return inv ? <span className="num text-sm">{inv.number}</span> : <span className="text-muted-foreground">—</span>;
      },
    },
    {
      key: "method",
      header: "Method",
      render: (row) => <StatusBadge status={row.method} />,
      sortValue: (row) => row.method,
    },
    {
      key: "bank",
      header: "Bank / Reference",
      render: (row) =>
        row.bank ? (
          <div>
            <p className="text-sm">{row.bank}</p>
            {row.reference && (
              <p className="num text-xs text-muted-foreground">{row.reference}</p>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      hideOnMobile: true,
    },
    {
      key: "branch",
      header: "Branch",
      render: (row) => branches.find((b) => b.id === row.branchId)?.name ?? "—",
      hideOnMobile: true,
    },
    {
      key: "received_by",
      header: "Received by",
      render: (row) => users.find((u) => u.id === row.receivedBy)?.name ?? "—",
      hideOnMobile: true,
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (row) => <CurrencyDisplay value={row.amount} className="font-semibold" />,
      sortValue: (row) => row.amount,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total received" value={formatCurrency(summary.total)} loading={payments.isLoading} />
        <StatCard label="Cash" value={formatCurrency(summary.cash)} loading={payments.isLoading} />
        <StatCard label="Bank" value={formatCurrency(summary.bank)} loading={payments.isLoading} />
      </div>

      <SectionCard contentClassName="p-0">
        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder="Search by number or reference" />
          <FilterSelect
            label="Method"
            value={method}
            onChange={(v) => setMethod(v as typeof method)}
            options={[
              { value: "all", label: "All methods" },
              { value: "Cash", label: "Cash" },
              { value: "Bank", label: "Bank" },
            ]}
          />
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Branch</span>
            <LocationSelect value={location} onChange={setLocation} includeAll />
          </div>
        </FilterBar>
        <DataTable
          columns={columns}
          rows={payments.data ?? []}
          rowKey={(row) => row.id}
          loading={payments.isLoading}
          error={payments.error}
          onRetry={() => void payments.refetch()}
          pageSize={12}
          caption="Payment records"
          empty={{
            title: "No payments found",
            description: "Payments are recorded against invoices from the Invoices screen.",
          }}
        />
      </SectionCard>
    </div>
  );
}

/* ======================== Expenses Tab ======================== */

function ExpensesTab() {
  const { can } = useSession();
  const qc = useQueryClient();
  const [category, setCategory] = useState<ExpenseCategory | "all">("all");
  const [location, setLocation] = useState("all");
  const [expenseOpen, setExpenseOpen] = useState(false);

  const expenses = useQuery({
    queryKey: ["expenses", category, location],
    queryFn: () => financeService.listExpenses({ category, branchId: location }),
  });

  const branches = catalogService.branches();
  const users = catalogService.users();

  const totalExpenses = (expenses.data ?? []).reduce((s, e) => s + e.amount, 0);

  const columns: Array<Column<Expense>> = [
    {
      key: "date",
      header: "Date",
      render: (row) => <DateDisplay value={row.date} />,
      sortValue: (row) => row.date,
    },
    {
      key: "category",
      header: "Category",
      render: (row) => <StatusBadge status={row.category} />,
      sortValue: (row) => row.category,
    },
    {
      key: "description",
      header: "Description",
      render: (row) => <span className="text-sm">{row.description}</span>,
    },
    {
      key: "method",
      header: "Method",
      render: (row) => <StatusBadge status={row.method} />,
      hideOnMobile: true,
    },
    {
      key: "branch",
      header: "Branch",
      render: (row) => branches.find((b) => b.id === row.branchId)?.name ?? "—",
      hideOnMobile: true,
    },
    {
      key: "recorded_by",
      header: "Recorded by",
      render: (row) => users.find((u) => u.id === row.recordedBy)?.name ?? "—",
      hideOnMobile: true,
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (row) => <CurrencyDisplay value={row.amount} className="font-semibold" />,
      sortValue: (row) => row.amount,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <StatCard label="Total expenses" value={formatCurrency(totalExpenses)} loading={expenses.isLoading} />
        {can("expenses.create") && (
          <Button onClick={() => setExpenseOpen(true)}>
            <Plus className="mr-2 size-4" />
            Record expense
          </Button>
        )}
      </div>

      <SectionCard contentClassName="p-0">
        <FilterBar>
          <FilterSelect
            label="Category"
            value={category}
            onChange={(v) => setCategory(v as typeof category)}
            options={[
              { value: "all", label: "All categories" },
              ...EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c })),
            ]}
          />
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Branch</span>
            <LocationSelect value={location} onChange={setLocation} includeAll />
          </div>
        </FilterBar>
        <DataTable
          columns={columns}
          rows={expenses.data ?? []}
          rowKey={(row) => row.id}
          loading={expenses.isLoading}
          error={expenses.error}
          onRetry={() => void expenses.refetch()}
          pageSize={12}
          caption="Expenses"
          empty={{
            title: "No expenses recorded",
            description: "Record operating expenses such as rent, utilities and transport.",
            action: can("expenses.create") ? (
              <Button onClick={() => setExpenseOpen(true)}>
                <Plus className="mr-2 size-4" />
                Record expense
              </Button>
            ) : undefined,
          }}
        />
      </SectionCard>

      {expenseOpen && (
        <ExpenseForm
          onClose={() => setExpenseOpen(false)}
          onSaved={() => {
            void qc.invalidateQueries({ queryKey: ["expenses"] });
            setExpenseOpen(false);
          }}
        />
      )}
    </div>
  );
}

/* ======================== Expense Form ======================== */

function ExpenseForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useSession();
  const branches = catalogService.branches().filter((b) => b.status === "active");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState<ExpenseCategory>("Rent");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("Cash");
  const [bank, setBank] = useState("");
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const saveMut = useMutation({
    mutationFn: () =>
      financeService.saveExpense({
        date,
        category,
        amount: parseFloat(amount),
        method,
        branchId,
        description,
        recordedBy: user!.id,
      }),
    onSuccess: () => {
      toast.success("Expense recorded.");
      onSaved();
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record expense</DialogTitle>
          <DialogDescription>Operating costs and overheads for this branch.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Date *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Amount (ETB) *</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Payment method *</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Bank">Bank</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {method === "Bank" && (
              <div className="col-span-2 space-y-1.5">
                <Label>Bank</Label>
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
            )}
            <div className="space-y-1.5">
              <Label>Branch *</Label>
              <LocationSelect value={branchId} onChange={setBranchId} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Description *</Label>
              <Textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the expense"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-md border border-dashed border-border bg-muted/30 p-3 text-sm text-muted-foreground">
            <Paperclip className="size-4 shrink-0" />
            <span>Attachment upload — available in a future release.</span>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending || !amount || !description.trim()}
          >
            {saveMut.isPending ? "Saving…" : "Record expense"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
