import { useState, type FormEvent } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, ArrowRight } from "lucide-react";
import { Logo } from "@/components/common/Logo";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@/api/client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const from = (location.state as { from?: string } | null)?.from ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(
    params.get("expired") ? "Your session expired. Please sign in again." : null,
  );
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!EMAIL_RE.test(email)) next.email = "Enter a valid email address";
    if (password.length < 1) next.password = "Password is required";
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    setFormError(null);
    try {
      await login({ email, password, remember_me: remember });
      navigate(from, { replace: true });
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : "Unable to sign in. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-12 text-primary-foreground lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        <div className="relative">
          <Logo />
        </div>
        <div className="relative space-y-5">
          <svg viewBox="0 0 320 120" className="h-24 w-full max-w-sm" aria-hidden>
            <polyline
              points="0,96 45,84 90,88 135,60 180,66 225,36 270,44 320,12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-80"
            />
            {[
              [45, 84],
              [135, 60],
              [225, 36],
              [320, 12],
            ].map(([x, y]) => (
              <circle key={x} cx={x} cy={y} r="3.5" fill="currentColor" />
            ))}
          </svg>
          <h2 className="text-3xl font-bold leading-tight">
            Real-time Airfare Price
            <br />
            Intelligence for India
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-primary-foreground/70">
            Monitor airfare movements, route-level trends and booking-window
            elasticity through high-frequency flight data and transparent
            statistical analytics.
          </p>
        </div>
        <p className="relative text-xs text-primary-foreground/50">
          Experimental prototype — not an official CPI methodology.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-col items-center justify-center px-6 py-12">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-sm">
          <div className="lg:hidden">
            <Logo />
          </div>
          <h1 className="mt-8 text-2xl font-bold tracking-tight lg:mt-0">
            Welcome back
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Sign in to the AIRINDEX analytics workspace.
          </p>

          {formError && (
            <div
              role="alert"
              className="mt-5 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
            />
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
            />

            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-input text-accent focus:ring-ring"
                />
                Remember me
              </label>
              <button
                type="button"
                className="text-sm font-medium text-accent hover:underline"
                onClick={() =>
                  setFormError("Password recovery is not enabled in the prototype.")
                }
              >
                Forgot password?
              </button>
            </div>

            <Button type="submit" size="lg" loading={loading} className="w-full">
              Sign in
              {!loading && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>

          <div className="mt-6 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Demo access:</span>{" "}
            analyst@airindex.dev / airindex123
          </div>
        </div>
      </div>
    </div>
  );
}
