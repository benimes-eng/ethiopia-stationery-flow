import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Paperclip, Wallet } from "lucide-react";
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
import { catalogService } from "@/services/catalog.service";
import { formatCurrency } from "@/lib/format";
import type { Expense, ExpenseCategory, PaymentMethod } from "@/domain/types";

export const Route = createFileRoute("/expenses")({
  head: () => ({
    meta: [{ title: "Expenses — Stationery Management" }],
  }),
  component: ExpensesRoute,
});

function ExpensesRoute() {
  return (
    <AppLayout permission="expenses.view">
      <ExpensesList />
    </AppLayout>
  );
}

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Rent",
  "Utilities",
  "Transport",
  "Supplies",
  "Maintenance",
  "Salary",
  "Other",
];

const BANKS = [
  "Commercial Bank of Ethiopia",
  "Awash Bank",
  "Dashen Bank",
  "Bank of Abyssinia",
  "Hibret Bank",
  "Other",
];

function ExpensesList() {
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
    <div className="space-y-6">
      <PageHeader
        title="Operating Expenses"
        description="Track overhead costs, branch maintenance, transport, rent and operational expenditures."
        actions={
          can("expenses.create") ? (
            <Button onClick={() => setExpenseOpen(true)}>
              <Plus className="mr-2 size-4" />
              Record expense
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total expenses (filtered)"
          value={formatCurrency(totalExpenses)}
          loading={expenses.isLoading}
        />
        <StatCard
          label="Entries"
          value={String(expenses.data?.length ?? 0)}
          loading={expenses.isLoading}
        />
        <StatCard
          label="Avg per entry"
          value={formatCurrency(
            expenses.data && expenses.data.length > 0
              ? totalExpenses / expenses.data.length
              : 0,
          )}
          loading={expenses.isLoading}
        />
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
          caption="Operating expenses"
          empty={{
            title: "No expenses recorded",
            description: "Record operating expenses such as rent, utilities, and transport.",
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
        <ExpenseFormModal
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

function ExpenseFormModal({
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
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
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
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
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
            <span>Attachment receipt upload — coming in a future release.</span>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
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
