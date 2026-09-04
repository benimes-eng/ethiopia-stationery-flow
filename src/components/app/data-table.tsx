import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { EmptyState, ErrorState, LoadingState } from "./primitives";

/* -------------------------------- Filters ------------------------------- */

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className,
  autoFocus,
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className={cn("relative w-full sm:max-w-xs", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9"
        aria-label={placeholder}
      />
    </div>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:flex-wrap sm:items-end">
      {children}
    </div>
  );
}

export function FilterSelect({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full sm:w-[190px]">
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/* ------------------------------- Data table ----------------------------- */

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  align?: "left" | "right";
  /** Hidden on small screens to keep tablet layouts readable. */
  hideOnMobile?: boolean;
  className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  onRetry,
  empty,
  onRowClick,
  pageSize = 10,
  caption,
  footer,
}: {
  columns: Array<Column<T>>;
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  empty?: { title: string; description?: string; action?: ReactNode };
  onRowClick?: (row: T) => void;
  pageSize?: number;
  caption?: string;
  footer?: ReactNode;
}) {
  const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.key === sort.key);
    if (!column?.sortValue) return rows;
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = column.sortValue!(a);
      const bv = column.sortValue!(b);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
      return String(av).localeCompare(String(bv)) * factor;
    });
  }, [rows, sort, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, totalPages);
  const visible = sorted.slice((current - 1) * pageSize, current * pageSize);

  if (loading) return <LoadingState rows={pageSize > 6 ? 6 : pageSize} label="Loading data" />;
  if (error) return <ErrorState onRetry={onRetry} />;
  if (rows.length === 0)
    return (
      <EmptyState
        title={empty?.title ?? "Nothing here yet"}
        description={empty?.description}
        action={empty?.action}
      />
    );

  return (
    <div>
      <div className="overflow-x-auto">
        <Table>
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn(
                    column.align === "right" && "text-right",
                    column.hideOnMobile && "hidden md:table-cell",
                    column.className,
                  )}
                >
                  {column.sortValue ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                      onClick={() =>
                        setSort((prev) =>
                          prev?.key === column.key
                            ? { key: column.key, direction: prev.direction === "asc" ? "desc" : "asc" }
                            : { key: column.key, direction: "asc" },
                        )
                      }
                    >
                      {column.header}
                      {sort?.key === column.key ? (
                        sort.direction === "asc" ? (
                          <ArrowUp className="size-3" />
                        ) : (
                          <ArrowDown className="size-3" />
                        )
                      ) : null}
                    </button>
                  ) : (
                    column.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((row) => (
              <TableRow
                key={rowKey(row)}
                tabIndex={onRowClick ? 0 : undefined}
                role={onRowClick ? "button" : undefined}
                onKeyDown={(e) => {
                  if (!onRowClick) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onRowClick(row);
                  }
                }}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={onRowClick ? "cursor-pointer" : undefined}
              >
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    className={cn(
                      column.align === "right" && "text-right",
                      column.hideOnMobile && "hidden md:table-cell",
                    )}
                  >
                    {column.render(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {footer}
      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
          <p className="text-xs text-muted-foreground">
            Showing {(current - 1) * pageSize + 1}–{Math.min(current * pageSize, sorted.length)} of{" "}
            {sorted.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={current === 1}
              onClick={() => setPage(current - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="num text-xs text-muted-foreground">
              {current} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={current === totalPages}
              onClick={() => setPage(current + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
