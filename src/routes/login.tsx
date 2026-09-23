import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, ChevronDown, ChevronUp, Loader2, LockKeyhole, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuthError, DEV_ACCOUNTS, authService } from "@/services/auth.service";
import { catalogService } from "@/services/catalog.service";
import { useSessionStore } from "@/stores/session-store";
import { useHydrateSession } from "@/hooks/use-session";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});
type LoginFormValues = z.infer<typeof loginSchema>;

const signupSchema = z.object({
  organizationName: z.string().min(2, "Organization name must be at least 2 characters."),
  ownerName: z.string().min(2, "Full name is required."),
  email: z.string().email("Enter a valid work email."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  phone: z.string().min(7, "Phone number is required."),
  address: z.string().optional(),
  tin: z.string().optional(),
});
type SignupFormValues = z.infer<typeof signupSchema>;

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Stationery Management" },
      {
        name: "description",
        content:
          "Sign in to the Stationery business management workspace for point of sale, inventory, purchasing and reporting.",
      },
      { property: "og:title", content: "Sign in — Stationery Management" },
      {
        property: "og:description",
        content: "Secure cloud workspace for Ethiopian stationery retail and wholesale operations.",
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
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [showDevAccounts, setShowDevAccounts] = useState(false);
  const tenant = catalogService.tenant();

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const signupForm = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      organizationName: "",
      ownerName: "",
      email: "",
      password: "",
      phone: "+251 ",
      address: "Addis Ababa, Ethiopia",
      tin: "",
    },
  });

  useEffect(() => {
    if (hydrated && user) navigate({ to: "/", replace: true });
  }, [hydrated, user, navigate]);

  const onLoginSubmit = async (values: LoginFormValues) => {
    setError(null);
    try {
      const account = await authService.login(values.email, values.password);
      signIn(account);
      toast.success(`Welcome back, ${account.name.split(" ")[0]}`);
      // Superadmin goes to their console; everyone else goes to the dashboard
      if (account.role === "superadmin") {
        navigate({ to: "/superadmin", replace: true });
      } else {
        navigate({ to: "/", replace: true });
      }
    } catch (err) {
      const message =
        err instanceof AuthError ? err.message : "Sign in failed. Please check credentials.";
      setError(message);
    }
  };

  const onSignupSubmit = async (values: SignupFormValues) => {
    setError(null);
    try {
      const { user: newOwner, tenant: newTenant } = await authService.signup({
        organizationName: values.organizationName,
        ownerName: values.ownerName,
        email: values.email,
        password: values.password,
        phone: values.phone,
        address: values.address,
        tin: values.tin,
      });
      // Don't sign in yet — org is pending approval. Show info message instead.
      toast.info(
        `Organization "${newTenant.name}" registered! Your account is pending approval by the platform administrator. You'll be able to log in once approved.`,
        { duration: 8000 }
      );
      setActiveTab("signin");
      loginForm.setValue("email", newOwner.email);
    } catch (err: any) {
      setError(err?.message || "Registration failed. Please try again.");
    }
  };


  const useDemoAccount = (email: string) => {
    loginForm.setValue("email", email);
    loginForm.setValue("password", "demo1234");
    void loginForm.handleSubmit(onLoginSubmit)();
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-sidebar p-10 lg:flex">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-md bg-primary text-lg font-bold text-primary-foreground">
            S
          </span>
          <div>
            <p className="text-sm font-semibold">{tenant.name}</p>
            <p className="text-xs text-muted-foreground">Enterprise Multi-Tenant SaaS Workspace</p>
          </div>
        </div>
        <div className="max-w-md space-y-4">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            Run every branch, warehouse and register from one cloud workspace.
          </h2>
          <p className="text-sm text-muted-foreground">
            Real-time multi-device cloud synchronization. Make sales on your phone, monitor inventory
            on your PC, and issue invoices across all branches instantly.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Multi-device real-time sync via Cloudflare Edge storage</li>
            <li>• Multi-branch inventory with append-only stock ledger</li>
            <li>• Role-based sub-accounts (Manager, Cashier, Storekeeper, Accountant)</li>
            <li>• Retail & wholesale pricing with VAT / TOT tax rules</li>
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">
          Stationery Management Cloud SaaS • Isolated multi-organization security.
        </p>
      </div>

      <div className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight">
              {activeTab === "signin" ? "Sign in" : "Create an Organization"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {activeTab === "signin"
                ? "Enter your credentials to access your organization workspace."
                : "Register your stationery business to get an isolated cloud workspace."}
            </p>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={(v) => {
              setActiveTab(v as "signin" | "signup");
              setError(null);
            }}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            {error ? (
              <Alert variant="destructive" className="mt-4">
                <LockKeyhole className="size-4" />
                <AlertTitle>Authentication error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            {/* -------------------- SIGN IN TAB -------------------- */}
            <TabsContent value="signin" className="mt-4">
              <form className="space-y-4" onSubmit={loginForm.handleSubmit(onLoginSubmit)} noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="login-email">Work email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    placeholder="user@example.com"
                    {...loginForm.register("email")}
                    aria-invalid={!!loginForm.formState.errors.email}
                  />
                  {loginForm.formState.errors.email ? (
                    <p className="text-xs text-destructive">
                      {loginForm.formState.errors.email.message}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Enter password"
                    {...loginForm.register("password")}
                    aria-invalid={!!loginForm.formState.errors.password}
                  />
                  {loginForm.formState.errors.password ? (
                    <p className="text-xs text-destructive">
                      {loginForm.formState.errors.password.message}
                    </p>
                  ) : null}
                </div>
                <Button type="submit" className="w-full" disabled={loginForm.formState.isSubmitting}>
                  {loginForm.formState.isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" /> Signing in…
                    </>
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </form>
            </TabsContent>

            {/* -------------------- SIGN UP TAB -------------------- */}
            <TabsContent value="signup" className="mt-4">
              <form className="space-y-3" onSubmit={signupForm.handleSubmit(onSignupSubmit)} noValidate>
                <div className="space-y-1">
                  <Label htmlFor="org-name">Organization / Business Name *</Label>
                  <Input
                    id="org-name"
                    placeholder="e.g. Abay Stationery PLC"
                    {...signupForm.register("organizationName")}
                  />
                  {signupForm.formState.errors.organizationName ? (
                    <p className="text-xs text-destructive">
                      {signupForm.formState.errors.organizationName.message}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="owner-name">Owner Full Name *</Label>
                  <Input
                    id="owner-name"
                    placeholder="e.g. Abebe Kebede"
                    {...signupForm.register("ownerName")}
                  />
                  {signupForm.formState.errors.ownerName ? (
                    <p className="text-xs text-destructive">
                      {signupForm.formState.errors.ownerName.message}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="signup-email">Work Email *</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="owner@stationery.et"
                    {...signupForm.register("email")}
                  />
                  {signupForm.formState.errors.email ? (
                    <p className="text-xs text-destructive">
                      {signupForm.formState.errors.email.message}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="signup-password">Password *</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Minimum 6 characters"
                    {...signupForm.register("password")}
                  />
                  {signupForm.formState.errors.password ? (
                    <p className="text-xs text-destructive">
                      {signupForm.formState.errors.password.message}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="signup-phone">Phone Number *</Label>
                  <Input id="signup-phone" {...signupForm.register("phone")} />
                  {signupForm.formState.errors.phone ? (
                    <p className="text-xs text-destructive">
                      {signupForm.formState.errors.phone.message}
                    </p>
                  ) : null}
                </div>

                <Button type="submit" className="w-full mt-2" disabled={signupForm.formState.isSubmitting}>
                  {signupForm.formState.isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" /> Creating Organization…
                    </>
                  ) : (
                    <>
                      <Building2 className="mr-2 size-4" /> Create Organization & Sign In
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {/* Collapsed Discrete Dev Accounts Toggle (Hidden by Default) */}
          <div className="pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => setShowDevAccounts((prev) => !prev)}
              className="flex items-center justify-between w-full text-xs text-muted-foreground hover:text-foreground py-1 transition-colors"
            >
              <span>Testing / Demo Accounts</span>
              {showDevAccounts ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </button>

            {showDevAccounts && (
              <div className="mt-2 space-y-2 rounded-lg border border-dashed border-border p-3 bg-muted/30">
                <p className="text-xs font-medium">Pre-seeded accounts (password: demo1234)</p>
                <div className="flex flex-wrap gap-1.5">
                  {DEV_ACCOUNTS.map((account) => (
                    <Button
                      key={account.email}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 px-2"
                      onClick={() => useDemoAccount(account.email)}
                    >
                      {account.label}
                    </Button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Click any role to test demo accounts.
                </p>
              </div>
            )}
          </div>

          <div className="text-center pt-2">
            <a
              href="/superadmin"
              className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
            >
              Super Admin Portal →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

