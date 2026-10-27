import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { AlertCircle, BellRing, LockKeyhole, Package, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { ApiError } from "../../api/errors";
import { MOCK_ACCOUNTS } from "../../api/mock/authMock";
import GoogleButton from "../../components/auth/GoogleButton";
import OrDivider from "../../components/auth/OrDivider";
import PasswordInput from "../../components/auth/PasswordInput";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import FormField from "../../components/ui/form/FormField";
import { useToast } from "../../components/ui/toast/useToast";
import { useAuth } from "../../context/auth/useAuth";
import { BRAND } from "../../lib/brand";
import { USE_MOCK } from "../../lib/env";

const schema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required").min(8, "Password must be at least 8 characters"),
});

type LoginValues = z.infer<typeof schema>;

// حط الصورة في public/auth-bg.jpg
const BG_IMAGE = "/auth-bg.jpg";

const HIGHLIGHTS = [
  { icon: Package, text: "Products, stock and suppliers in one place" },
  { icon: BellRing, text: "Low-stock alerts before you run out" },
  { icon: ShieldCheck, text: "Role-based access for admins and staff" },
];

function errorText(error: unknown): string | null {
  if (!error) return null;
  return error instanceof ApiError ? error.message : "Something went wrong. Please try again.";
}

export default function Login() {
  const { login, loginWithGoogle } = useAuth();
  const toast = useToast();

  const { control, handleSubmit, setValue } = useForm<LoginValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  // On success the GuestRoute around this page sends the user to where they were going.
  const signIn = useMutation({
    mutationFn: (values: LoginValues) => login(values),
    onSuccess: (user) => toast.success(`Welcome back, ${user.name}`),
  });

  const googleSignIn = useMutation({
    mutationFn: (idToken: string) => loginWithGoogle(idToken),
    onSuccess: (user) => toast.success(`Welcome back, ${user.name}`),
  });

  const onSubmit = handleSubmit((values) => signIn.mutate(values));
  const message = errorText(signIn.error) ?? errorText(googleSignIn.error);

  const fillDemo = (email: string, password: string) => {
    setValue("email", email, { shouldValidate: true });
    setValue("password", password, { shouldValidate: true });
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* ===== الجانب الجمالي ===== */}
      <aside className="relative hidden overflow-hidden text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        {/* الصورة */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${BG_IMAGE})` }}
          aria-hidden="true"
        />
        {/* طبقة البرتقالي الخفيفة */}
        <div
          className="absolute inset-0 bg-gradient-to-br from-primary-700/75 via-primary-600/45 to-primary-500/20"
          aria-hidden="true"
        />
        {/* تظليل عشان النص يبقى مقروء */}
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/30"
          aria-hidden="true"
        />

        {/* اللوجو */}
        <div className="relative z-10 text-xl font-bold tracking-tight">{BRAND}</div>

        {/* المحتوى */}
        <div className="relative z-10 max-w-lg">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur-md">
            <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
            Secure sign-in
          </span>

          <h2 className="mt-5 text-4xl font-bold leading-tight">Welcome back to {BRAND}.</h2>
          <p className="mt-3 text-base text-white/80">
            Sign in to pick up where you left off — your catalogue, orders and stock levels are waiting.
          </p>

          <ul className="mt-8 space-y-3">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li
                key={text}
                className="flex items-center gap-3 rounded-control border border-white/15 bg-white/10 px-4 py-3 text-sm backdrop-blur-md"
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-white/60">
          © {new Date().getFullYear()} {BRAND}
        </p>
      </aside>

      {/* ===== الفورم ===== */}
      <main className="flex items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-md">
          {/* لوجو للموبايل بس */}
          <div className="mb-8 text-xl font-bold tracking-tight text-primary-600 lg:hidden">{BRAND}</div>

          <h1 className="text-2xl font-bold text-ink">Sign in</h1>
          <p className="mt-1 text-sm text-muted">Enter your work email and password.</p>

          {message && (
            <div
              role="alert"
              className="mt-5 flex items-start gap-2 rounded-control border border-danger-600/30 bg-danger-50 px-3 py-2.5 text-sm text-danger-700 animate-pop-in"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {message}
            </div>
          )}

          <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
            <FormField control={control} name="email" label="Email" required>
              {({ field, aria }) => (
                <Input {...field} {...aria} type="email" autoComplete="email" placeholder="you@company.com" />
              )}
            </FormField>

            <FormField control={control} name="password" label="Password" required>
              {({ field, aria }) => (
                <PasswordInput {...field} {...aria} autoComplete="current-password" placeholder="••••••••" />
              )}
            </FormField>

            <Button type="submit" size="lg" fullWidth loading={signIn.isPending} disabled={googleSignIn.isPending}>
              {signIn.isPending ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <OrDivider />

          <GoogleButton
            variant="signin_with"
            disabled={signIn.isPending || googleSignIn.isPending}
            onCredential={(token) => googleSignIn.mutate(token)}
          />

          <p className="mt-6 text-center text-sm text-muted">
            New to {BRAND}?{" "}
            <Link to="/register" className="font-semibold text-primary-600 hover:text-primary-700 hover:underline">
              Create an account
            </Link>
          </p>

          {USE_MOCK && (
            <div className="mt-6 rounded-control border border-dashed border-primary-300 bg-primary-50/60 p-3 text-xs text-muted">
              <p className="font-semibold text-primary-700">Mock mode — demo accounts</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {MOCK_ACCOUNTS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => fillDemo(a.email, a.password)}
                    className="rounded-full border border-primary-200 bg-white px-3 py-1 font-medium text-primary-700 transition hover:bg-primary-100"
                  >
                    Fill {a.role.toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}