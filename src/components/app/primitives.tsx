import type { ReactNode } from "react";
import { AlertCircle, Inbox, Loader2, LockKeyhole, TriangleAlert } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";

/* ------------------------------ Page header ----------------------------- */

export function PageHeader({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-border pb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description ? (
            <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </header>
  );
}

export function SectionCard({
  title,
  description,
  actions,
  className,
  children,
  contentClassName,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("panel", className)}>
      {title ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions}
        </div>
      ) : null}
      <div className={cn("p-5", contentClassName)}>{children}</div>
    </section>
  );
}

/* -------------------------------- Stat card ----------------------------- */

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
  loading,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  tone?: "default" | "positive" | "warning" | "critical";
  loading?: boolean;
}) {
  const toneClass = {
    default: "text-foreground",
    positive: "text-success",
    warning: "text-warning",
    critical: "text-destructive",
  }[tone];

  return (
    <div className="panel flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      </div>
      {loading ? (
        <Skeleton className="h-7 w-28" />
      ) : (
        <span className={cn("num text-2xl font-semibold tracking-tight", toneClass)}>{value}</span>
      )}
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

export function ChartCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <SectionCard
      title={title}
      description={description}
      actions={actions}
      className={className}
      contentClassName="p-4"
    >
      <div className="h-[260px] w-full">{children}</div>
    </SectionCard>
  );
}

/* ------------------------------ Status badge ---------------------------- */

const STATUS_TONES: Record<string, string> = {
  // positive
  Active: "bg-success/10 text-success border-success/20",
  Approved: "bg-success/10 text-success border-success/20",
  Received: "bg-success/10 text-success border-success/20",
  Paid: "bg-success/10 text-success border-success/20",
  Accepted: "bg-success/10 text-success border-success/20",
  Confirmed: "bg-success/10 text-success border-success/20",
  Fulfilled: "bg-success/10 text-success border-success/20",
  Completed: "bg-success/10 text-success border-success/20",
  completed: "bg-success/10 text-success border-success/20",
  "In stock": "bg-success/10 text-success border-success/20",
  Converted: "bg-primary/10 text-primary border-primary/20",
  Issued: "bg-primary/10 text-primary border-primary/20",
  Sent: "bg-primary/10 text-primary border-primary/20",
  "In Transit": "bg-info/10 text-info border-info/20",
  Requested: "bg-info/10 text-info border-info/20",
  Counting: "bg-info/10 text-info border-info/20",
  // caution
  "Pending Approval": "bg-warning/15 text-warning-foreground border-warning/30",
  "Partially Received": "bg-warning/15 text-warning-foreground border-warning/30",
  "Partially Paid": "bg-warning/15 text-warning-foreground border-warning/30",
  "Partially Fulfilled": "bg-warning/15 text-warning-foreground border-warning/30",
  "Low stock": "bg-warning/15 text-warning-foreground border-warning/30",
  held: "bg-warning/15 text-warning-foreground border-warning/30",
  // negative
  Cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  Rejected: "bg-destructive/10 text-destructive border-destructive/20",
  Expired: "bg-destructive/10 text-destructive border-destructive/20",
  "Out of stock": "bg-destructive/10 text-destructive border-destructive/20",
  Inactive: "bg-muted text-muted-foreground border-border",
  inactive: "bg-muted text-muted-foreground border-border",
  Archived: "bg-muted text-muted-foreground border-border",
  archived: "bg-muted text-muted-foreground border-border",
  Draft: "bg-muted text-muted-foreground border-border",
  returned: "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        STATUS_TONES[status] ?? "bg-secondary text-secondary-foreground border-border",
        className,
      )}
    >
      {label}
    </span>
  );
}

/* --------------------------------- States ------------------------------- */

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon ?? <Inbox className="size-5" />}
      </span>
      <div className="space-y-1">
        <p className="text-sm font-semibold">{title}</p>
        {description ? (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this data. Your connection may have been interrupted.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertCircle className="size-5" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}

export function LoadingState({ rows = 5, label }: { rows?: number; label?: string }) {
  return (
    <div className="space-y-3 p-5" aria-busy="true" aria-live="polite">
      {label ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> {label}
        </p>
      ) : null}
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

export function PermissionDenied({ permission }: { permission?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <LockKeyhole className="size-5" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-semibold">You don't have access to this screen</p>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          Your role doesn't include{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">{permission ?? "this permission"}</code>.
          Ask an owner or manager to update your access.
        </p>
      </div>
    </div>
  );
}

/** Honest placeholder for modules that require future infrastructure. */
export function PlannedFeatureNotice({
  title,
  description,
  status = "Coming in a future release",
}: {
  title: string;
  description: string;
  status?: string;
}) {
  return (
    <div className="flex gap-3 rounded-lg border border-dashed border-border bg-muted/40 p-4">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
      <div className="space-y-1">
        <p className="text-sm font-medium">
          {title} <span className="text-muted-foreground">— {status}</span>
        </p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

/* ----------------------------- Value displays --------------------------- */

export function CurrencyDisplay({
  value,
  compact,
  className,
  muted,
}: {
  value: number;
  compact?: boolean;
  className?: string;
  muted?: boolean;
}) {
  return (
    <span className={cn("num", muted && "text-muted-foreground", className)}>
      {formatCurrency(value, { compact })}
    </span>
  );
}

export function DateDisplay({ value, withTime }: { value: string; withTime?: boolean }) {
  return (
    <span className="num whitespace-nowrap">
      {withTime ? formatDateTime(value) : formatDate(value)}
    </span>
  );
}

/* ----------------------------- Confirm dialog --------------------------- */

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  destructive,
  onConfirm,
  children,
  disabled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  children?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children ? <div className="space-y-3">{children}</div> : null}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={disabled}
            onClick={onConfirm}
            className={destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export { formatCurrency, formatDate, formatDateTime };
