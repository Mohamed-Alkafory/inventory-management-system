import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, Check, X } from "lucide-react";
import { z } from "zod";
import { ApiError } from "../../api/errors";
import AuthLayout from "../../components/auth/AuthLayout";
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

function errorText(error: unknown): string | null {
  if (!error) return null;
  return error instanceof ApiError ? error.message : "Something went wrong. Please try again.";
}

export default function Register() {
  const { register: signUp } = useAuth();
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
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false,
    },
  });

  const password = useWatch({ control, name: "password" }) ?? "";
  const score = passwordScore(password);
  const strength = strengthLabel(score);

  const createAccount = useMutation({
    mutationFn: ({ name, email, password: pw }: RegisterValues) => signUp({ name, email, password: pw }),
    onSuccess: (user) => {
      toast.success(`Account created — welcome, ${user.name}`);
      // Public registration always creates a CUSTOMER, whose home is "/".
      navigate("/", { replace: true, state: { from: { pathname: "/" } } });
    },
  });

  const onSubmit = handleSubmit((values) => createAccount.mutate(values));
  const message = errorText(createAccount.error);

  return (
    <AuthLayout
      wide
      title="Create your account"
      subtitle={`Start tracking products, stock and orders with ${BRAND}.`}
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-primary-600 hover:text-primary-700 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      {message && (
        <div
          role="alert"
          className="mb-5 flex items-start gap-2 rounded-control border border-danger-600/30 bg-danger-50 px-3 py-2.5 text-sm text-danger-700 animate-pop-in"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {message}
        </div>
      )}

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

        <Button type="submit" size="lg" fullWidth loading={createAccount.isPending}>
          {createAccount.isPending ? "Creating account..." : "Create account"}
        </Button>
      </form>
    </AuthLayout>
  );
}
