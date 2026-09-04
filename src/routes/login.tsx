import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AuthError, DEV_ACCOUNTS, authService } from "@/services/auth.service";
import { catalogService } from "@/services/catalog.service";
import { useSessionStore } from "@/stores/session-store";
import { useHydrateSession } from "@/hooks/use-session";

const schema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});
type FormValues = z.infer<typeof schema>;

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Abay Stationery Management" },
      {
        name: "description",
        content:
          "Sign in to the Abay Stationery business management workspace for point of sale, inventory, purchasing and reporting.",
      },
      { property: "og:title", content: "Sign in — Abay Stationery Management" },
      {
        property: "og:description",
        content: "Secure workspace for Ethiopian stationery retail and wholesale operations.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  useHydrateSession();
  const navigate = useNavigate();
  const signIn = useSessionStore((s) => s.signIn);
  const user = useSessionStore((s) => s.user);
  const hydrated = useSessionStore((s) => s.hydrated);
  const [error, setError] = useState<string | null>(null);
  const tenant = catalogService.tenant();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    if (hydrated && user) navigate({ to: "/", replace: true });
  }, [hydrated, user, navigate]);

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      const account = await authService.login(values.email, values.password);
      signIn(account);
      toast.success(`Welcome back, ${account.name.split(" ")[0]}`);
      navigate({ to: "/", replace: true });
    } catch (err) {
      const message =
        err instanceof AuthError ? err.message : "Sign in failed. Please try again.";
      setError(message);
    }
  };

  const useDemoAccount = (email: string) => {
    form.setValue("email", email);
    form.setValue("password", "demo1234");
    void form.handleSubmit(onSubmit)();
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-sidebar p-10 lg:flex">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
            AS
          </span>
          <div>
            <p className="text-sm font-semibold">{tenant.name}</p>
            <p className="text-xs text-muted-foreground">Business management workspace</p>
          </div>
        </div>
        <div className="max-w-md space-y-4">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            Run every branch, warehouse and register from one workspace.
          </h2>
          <p className="text-sm text-muted-foreground">
            Point of sale, wholesale quotations, purchase receiving, stock counts, expenses and
            reporting — designed for medium and large Ethiopian stationery businesses.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Multi-branch inventory with an append-only stock ledger</li>
            <li>• Retail and wholesale pricing with a centralised tax engine</li>
            <li>• Role-based access for owners, managers, cashiers and storekeepers</li>
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">
          Demonstration environment with mock data. No live banking, mobile money or fiscal
          integration is connected.
        </p>
      </div>

      <div className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
            <p className="text-sm text-muted-foreground">
              Use a seeded development account to explore each role.
            </p>
          </div>

          {error ? (
            <Alert variant="destructive">
              <LockKeyhole className="size-4" />
              <AlertTitle>Sign in failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="owner@example.com"
                {...form.register("email")}
                aria-invalid={!!form.formState.errors.email}
              />
              {form.formState.errors.email ? (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="demo1234"
                {...form.register("password")}
                aria-invalid={!!form.formState.errors.password}
              />
              {form.formState.errors.password ? (
                <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
              ) : null}
            </div>
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <div className="space-y-2 rounded-lg border border-dashed border-border p-4">
            <p className="text-xs font-medium">Development accounts (password demo1234)</p>
            <div className="flex flex-wrap gap-2">
              {DEV_ACCOUNTS.map((account) => (
                <Button
                  key={account.email}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => useDemoAccount(account.email)}
                >
                  {account.label}
                </Button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Authentication is mocked against seeded users. Password reset emails are not sent.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
