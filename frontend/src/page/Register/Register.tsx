import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Check,
  Rocket,
  ShieldCheck,
  ShoppingBag,
  Store,
  Timer,
  UserPlus,
  X,
} from "lucide-react";
import { z } from "zod";
import { ApiError } from "../../api/errors";
import GoogleButton from "../../components/auth/GoogleButton";
import OrDivider from "../../components/auth/OrDivider";
import PasswordInput from "../../components/auth/PasswordInput";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import FormField from "../../components/ui/form/FormField";
import { useToast } from "../../components/ui/toast/useToast";
import { useAuth } from "../../context/auth/useAuth";
import { BRAND } from "../../lib/brand";
import { PASSWORD_RULES, isStrongPassword, passwordScore, strengthLabel } from "../../lib/passwordRules";

const schema = z
  .object({
    accountType: z.enum(["customer", "seller"]),
    name: z.string().trim().min(2, "Enter your full name"),
    email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
    password: z
      .string()
      .min(1, "Password is required")
      .refine(isStrongPassword, "Password doesn’t meet all the rules below"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
    acceptTerms: z.boolean().refine((v) => v, "You must accept the terms to continue"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterValues = z.infer<typeof schema>;
type AccountType = RegisterValues["accountType"];

const BG_IMAGE = "https://unsplash.com/photos/CpIWRMy0jkg/download?force=true&w=1800";

const HIGHLIGHTS = [
  { icon: Rocket, text: "14-day free trial, no credit card" },
  { icon: Timer, text: "Guided setup in about 5 minutes" },
  { icon: ShieldCheck, text: "Your data stays private and secure" },
];

const ACCOUNT_TYPES = [
  { value: "customer", icon: ShoppingBag, title: "I'm a customer", text: "Browse and buy products" },
  { value: "seller", icon: Store, title: "I'm a seller", text: "Open a store and sell" },
] as const;

// أين يروح المستخدم بعد التسجيل
const destinationFor = (type: AccountType) => (type === "seller" ? "/seller/onboarding" : "/");

function errorText(error: unknown): string | null {
  if (!error) return null;
  return error instanceof ApiError ? error.message : "Something went wrong. Please try again.";
}

export default function Register() {
  const { register: signUp, loginWithGoogle } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      accountType: "customer",
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false,
    },
  });

  const password = useWatch({ control, name: "password" }) ?? "";
  const accountType = useWatch({ control, name: "accountType" }) ?? "customer";
  const isSeller = accountType === "seller";
  const score = passwordScore(password);
  const strength = strengthLabel(score);

  const createAccount = useMutation({
    mutationFn: ({ name, email, password: pw }: RegisterValues) => signUp({ name, email, password: pw }),
    onSuccess: (user, variables) => {
      toast.success(`Account created — welcome, ${user.name}`);
      // Route through GuestRoute's redirect contract so it doesn't bounce us elsewhere.
      const target = destinationFor(variables.accountType);
      navigate(target, { replace: true, state: { from: { pathname: target } } });
    },
  });

  const googleSignUp = useMutation({
    mutationFn: ({ idToken }: { idToken: string; role: AccountType }) => loginWithGoogle(idToken),
    onSuccess: (user, variables) => {
      toast.success(`Welcome, ${user.name}`);
      const target = destinationFor(variables.role);
      navigate(target, { replace: true, state: { from: { pathname: target } } });
    },
  });

  const onSubmit = handleSubmit((values) => createAccount.mutate(values));
  const message = errorText(createAccount.error) ?? errorText(googleSignUp.error);
  const busy = createAccount.isPending || googleSignUp.isPending;

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* ===== الجانب الجمالي ===== */}
      <aside className="relative hidden overflow-hidden text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${BG_IMAGE})` }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-gradient-to-br from-primary-700/75 via-primary-600/45 to-primary-500/20"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/30"
          aria-hidden="true"
        />

        <div className="relative z-10 text-xl font-bold tracking-tight">{BRAND}</div>

        <div className="relative z-10 max-w-lg">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur-md">
            <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
            Create your account
          </span>

          <h2 className="mt-5 text-4xl font-bold leading-tight">Start managing smarter with {BRAND}.</h2>
          <p className="mt-3 text-base text-white/80">
            Create your account to track products, stock, orders and suppliers from one calm dashboard.
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
          <div className="mb-8 text-xl font-bold tracking-tight text-primary-600 lg:hidden">{BRAND}</div>

          <h1 className="text-2xl font-bold text-ink">Create account</h1>
          <p className="mt-1 text-sm text-muted">It takes less than a minute.</p>

          {message && (
            <div
              role="alert"
              className="mt-5 flex items-start gap-2 rounded-control border border-danger-600/30 bg-danger-50 px-3 py-2.5 text-sm text-danger-700 animate-pop-in"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {message}
            </div>
          )}

          {/* اختيار نوع الحساب */}
          <fieldset className="mt-6">
            <legend className="mb-2 text-sm font-medium text-ink">I want to join as</legend>
            <div className="grid grid-cols-2 gap-3">
              {ACCOUNT_TYPES.map(({ value, icon: Icon, title, text }) => (
                <label key={value} className="cursor-pointer">
                  <input type="radio" value={value} {...register("accountType")} className="peer sr-only" />
                  <div className="flex h-full flex-col gap-1 rounded-control border border-line p-3 transition hover:border-primary-300 peer-checked:border-primary-600 peer-checked:bg-primary-50 peer-checked:ring-1 peer-checked:ring-primary-600 peer-focus-visible:ring-2 peer-focus-visible:ring-primary-300">
                    <Icon className="h-5 w-5 text-primary-600" aria-hidden="true" />
                    <span className="text-sm font-semibold text-ink">{title}</span>
                    <span className="text-xs text-muted">{text}</span>
                  </div>
                </label>
              ))}
            </div>
            {isSeller && (
              <p className="mt-2 text-xs text-muted">
                After signing up, we'll walk you through setting up your store step by step.
              </p>
            )}
          </fieldset>

          <div className="mt-5">
            <GoogleButton
              variant="signup_with"
              disabled={busy}
              onCredential={(token) => googleSignUp.mutate({ idToken: token, role: accountType })}
            />
          </div>

          <OrDivider />

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <FormField control={control} name="name" label="Full name" required>
              {({ field, aria }) => <Input {...field} {...aria} autoComplete="name" placeholder="Your full name" />}
            </FormField>

            <FormField control={control} name="email" label="Email" required>
              {({ field, aria }) => (
                <Input {...field} {...aria} type="email" autoComplete="email" placeholder="you@company.com" />
              )}
            </FormField>

            <div>
              <FormField control={control} name="password" label="Password" required>
                {({ field, aria }) => (
                  <PasswordInput
                    {...field}
                    {...aria}
                    autoComplete="new-password"
                    placeholder="Create a strong password"
                  />
                )}
              </FormField>

              <div className="mt-3" aria-live="polite">
                <div className="flex gap-1.5" aria-hidden="true">
                  {PASSWORD_RULES.map((rule, i) => (
                    <span
                      key={rule.id}
                      className={`h-1.5 flex-1 rounded-full transition-colors duration-300 motion-reduce:transition-none ${
                        i < score && password ? strength.tone : "bg-slate-200"
                      }`}
                    />
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-muted">
                  {password ? (
                    <>
                      Password strength: <span className="font-semibold text-ink">{strength.label}</span>
                    </>
                  ) : (
                    "Your password must meet all of these rules:"
                  )}
                </p>
              </div>

              <ul className="mt-2 grid gap-1.5 sm:grid-cols-2" aria-label="Rules for your password">
                {PASSWORD_RULES.map((rule) => {
                  const met = rule.test(password);
                  return (
                    <li
                      key={rule.id}
                      className={`flex items-center gap-2 text-xs transition-colors duration-200 motion-reduce:transition-none ${
                        met ? "text-success-700" : "text-muted"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-colors duration-200 motion-reduce:transition-none ${
                          met ? "bg-success-600 text-white" : "bg-slate-200 text-slate-500"
                        }`}
                      >
                        {met ? (
                          <Check className="h-3 w-3" strokeWidth={3} />
                        ) : (
                          <X className="h-3 w-3" strokeWidth={3} />
                        )}
                      </span>
                      {rule.label}
                      <span className="sr-only">{met ? " — met" : " — not met yet"}</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <FormField control={control} name="confirmPassword" label="Confirm password" required>
              {({ field, aria }) => (
                <PasswordInput {...field} {...aria} autoComplete="new-password" placeholder="Repeat your password" />
              )}
            </FormField>

            <div>
              <label className="flex cursor-pointer items-start gap-2.5 text-sm text-muted">
                <input
                  type="checkbox"
                  {...register("acceptTerms")}
                  aria-invalid={errors.acceptTerms ? true : undefined}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-line accent-primary-600"
                />
                <span>
                  I agree to the <strong className="font-semibold text-ink">Terms of Service</strong> and{" "}
                  <strong className="font-semibold text-ink">Privacy Policy</strong>.
                </span>
              </label>
              {errors.acceptTerms && (
                <p role="alert" className="mt-1.5 text-xs font-medium text-danger-600">
                  {errors.acceptTerms.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              size="lg"
              fullWidth
              loading={createAccount.isPending}
              disabled={googleSignUp.isPending}
            >
              {createAccount.isPending ? "Creating account…" : isSeller ? "Create seller account" : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-primary-600 hover:text-primary-700 hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}