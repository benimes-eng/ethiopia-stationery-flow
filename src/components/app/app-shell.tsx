import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, Building, LogOut, Menu, Search, User as UserIcon, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandDialog,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSession } from "@/hooks/use-session";
import { useSessionStore } from "@/stores/session-store";
import { catalogService } from "@/services/catalog.service";
import { financeService } from "@/services/finance.service";
import { ROLES } from "@/domain/permissions";
import { visibleGroups } from "./navigation";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, permissions, role, branchId } = useSession();
  const setBranch = useSessionStore((s) => s.setBranch);
  const signOut = useSessionStore((s) => s.signOut);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const tenant = catalogService.tenant();
  const groups = useMemo(() => visibleGroups(permissions), [permissions]);
  const branches = catalogService.branches().filter((b) => b.status === "active");
  const notifications = financeService.notifications();
  const unread = notifications.filter((n) => !n.read).length;

  /** Managers and owners can switch branches; other roles stay branch-locked. */
  const canSwitchBranch = role?.key === "owner" || role?.key === "manager";

  useEffect(() => setMobileOpen(false), [pathname]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-4">
        <span className="flex size-9 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
          AS
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{tenant.name}</p>
          <p className="num truncate text-xs text-muted-foreground">TIN {tenant.tin}</p>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <nav className="space-y-5 px-3 py-4" aria-label="Main navigation">
          {groups.map((group) => (
            <div key={group.label} className="space-y-1">
              <p className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </p>
              {group.items.map((item) => {
                const active = pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                      active
                        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                    )}
                  >
                    <item.icon className="size-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </ScrollArea>
      <div className="border-t border-sidebar-border px-4 py-3">
        <p className="text-[11px] leading-snug text-muted-foreground">
          Mock data environment. No live payment, banking or fiscal integration is connected.
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar lg:block">
        <div className="sticky top-0 h-screen">{sidebar}</div>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div className="absolute left-0 top-0 h-full w-72 bg-sidebar shadow-xl">
            <div className="flex justify-end p-2">
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
                <X className="size-4" />
              </Button>
            </div>
            {sidebar}
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex flex-wrap items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="size-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="hidden items-center gap-2 text-muted-foreground sm:flex"
            onClick={() => setPaletteOpen(true)}
          >
            <Search className="size-4" />
            Jump to…
            <kbd className="ml-2 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px]">
              Ctrl K
            </kbd>
          </Button>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center gap-2 sm:flex">
              <Building className="size-4 text-muted-foreground" />
              <Select
                value={branchId}
                onValueChange={(value) => setBranch(value)}
                disabled={!canSwitchBranch}
              >
                <SelectTrigger className="w-[190px]" aria-label="Active branch">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All locations</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
                  <Bell className="size-4" />
                  {unread > 0 ? (
                    <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-destructive" />
                  ) : null}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <p className="text-sm font-semibold">Notifications</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => financeService.markNotificationsRead()}
                  >
                    Mark read
                  </Button>
                </div>
                <ScrollArea className="max-h-72">
                  <ul className="divide-y divide-border">
                    {notifications.slice(0, 12).map((notification) => (
                      <li key={notification.id} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium">{notification.title}</p>
                          {!notification.read ? (
                            <Badge variant="secondary" className="shrink-0 text-[10px]">
                              New
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{notification.body}</p>
                        <p className="num mt-1 text-[11px] text-muted-foreground">
                          {formatDateTime(notification.createdAt)}
                        </p>
                      </li>
                    ))}
                    {notifications.length === 0 ? (
                      <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                        Nothing to review.
                      </li>
                    ) : null}
                  </ul>
                </ScrollArea>
              </PopoverContent>
            </Popover>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2">
                  <span className="flex size-7 items-center justify-center rounded-full bg-muted">
                    <UserIcon className="size-3.5" />
                  </span>
                  <span className="hidden text-left sm:block">
                    <span className="block text-xs font-medium leading-tight">{user?.name}</span>
                    <span className="block text-[11px] leading-tight text-muted-foreground">
                      {user ? ROLES[user.role].name : ""}
                    </span>
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs font-normal text-muted-foreground">{user?.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    signOut();
                    navigate({ to: "/login" });
                  }}
                >
                  <LogOut className="mr-2 size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>

      <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen}>
          <CommandInput placeholder="Search screens…" />
            <CommandList>
              <CommandEmpty>No screen matches your search.</CommandEmpty>
              {groups.map((group) => (
                <CommandGroup key={group.label} heading={group.label}>
                  {group.items.map((item) => (
                    <CommandItem
                      key={item.to}
                      value={`${item.label} ${item.description}`}
                      onSelect={() => {
                        setPaletteOpen(false);
                        navigate({ to: item.to });
                      }}
                    >
                      <item.icon className="mr-2 size-4" />
                      <span className="flex-1">{item.label}</span>
                      <span className="text-xs text-muted-foreground">{item.description}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
          </CommandList>
      </CommandDialog>
    </div>
  );
}
