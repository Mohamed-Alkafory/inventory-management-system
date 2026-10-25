import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { AlertCircle, BellRing, Eye, EyeOff, LockKeyhole, Package, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { MOCK_ACCOUNTS } from "../../api/mock/authMock";
import { ApiError } from "../../api/errors";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import FormField from "../../components/ui/form/FormField";
import Reveal from "../../components/motion/Reveal";
import { useToast } from "../../components/ui/toast/useToast";
import { useAuth } from "../../context/auth/useAuth";
import { USE_MOCK } from "../../lib/env";
import { BRAND } from "../../lib/brand";

const schema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required").min(6, "Password must be at least 6 characters"),
});

type LoginValues = z.infer<typeof schema>;

const HIGHLIGHTS = [
  { icon: Package, text: "Products, stock and suppliers in one place" },
  { icon: BellRing, text: "Low-stock alerts before you run out" },
  { icon: ShieldCheck, text: "Role-based access for admins and staff" },
];

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const [showPassword, setShowPassword] = useState(false);

  const { control, handleSubmit, setValue } = useForm<LoginValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  // On success the GuestRoute around this page sends the user to where they were going.
  const mutation = useMutation({
    mutationFn: (values: LoginValues) => login(values),
    onSuccess: (user) => toast.success(`Welcome back, ${user.name}`),
  });

  const onSubmit = handleSubmit((values) => mutation.mutate(values));
  const errorMessage = mutation.error
    ? mutation.error instanceof ApiError
      ? mutation.error.message
      : "Something went wrong. Please try again."
    : null;

  const fillDemo = (email: string, password: string) => {
    setValue("email", email, { shouldValidate: true });
    setValue("password", password, { shouldValidate: true });
  };

  return (
    <main className="grid min-h-[calc(100vh-72px)] w-full bg-[#FDFDFC] font-sans text-ink lg:grid-cols-2">
      {/* Brand panel */}
      <section className="relative isolate hidden overflow-hidden bg-linear-to-br from-primary-600 via-primary-500 to-[#FF8A3D] p-12 text-white lg:flex lg:flex-col lg:justify-center">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-16 -top-20 h-80 w-80 animate-blob rounded-full bg-white/15 blur-3xl motion-reduce:animate-none" />
          <div
            className="absolute -bottom-24 right-0 h-96 w-96 animate-blob rounded-full bg-[#7A2B00]/30 blur-3xl motion-reduce:animate-none"
            style={{ animationDelay: "-7s" }}
          />
        </div>

        <Reveal>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur">
            <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
            Secure sign-in
          </span>
        </Reveal>

        <Reveal delay={100}>
          <h2 className="mt-6 max-w-md text-4xl font-bold leading-tight">Welcome back to {BRAND}.</h2>
        </Reveal>
        <Reveal delay={200}>
          <p className="mt-4 max-w-md leading-relaxed text-white/85">
            Sign in to pick up where you left off — your catalogue, orders and stock levels are waiting.
          </p>
        </Reveal>

        <ul className="mt-10 space-y-4">
          {HIGHLIGHTS.map(({ icon: Icon, text }, i) => (
            <li key={text}>
              <Reveal delay={300 + i * 120} direction="left">
                <div className="flex items-center gap-3 text-sm font-medium">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  {text}
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </section>

      {/* Form */}
      <section className="flex items-center justify-center px-4 py-12 sm:px-6">
        <Reveal className="w-full max-w-md">
          <div className="rounded-3xl border border-[#FDECDC] bg-white p-6 shadow-xl shadow-[#7A3410]/10 sm:p-8">
            <h1 className="text-2xl font-bold text-ink">Sign in</h1>
            <p className="mt-1 text-sm text-muted">Enter your work email and password.</p>

            {errorMessage && (
              <div
                role="alert"
                className="mt-5 flex items-start gap-2 rounded-control border border-danger-600/30 bg-danger-50 px-3 py-2.5 text-sm text-danger-700 animate-pop-in"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {errorMessage}
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
                  <div className="relative">
                    <Input
                      {...field}
                      {...aria}
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      aria-pressed={showPassword}
                      className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted transition hover:text-ink focus-visible:outline-2 focus-visible:outline-primary-500"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                )}
              </FormField>

              <Button type="submit" size="lg" fullWidth loading={mutation.isPending}>
                {mutation.isPending ? "Signing in…" : "Sign in"}
              </Button>
            </form>

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
        </Reveal>
      </section>
    </main>
  );
}
