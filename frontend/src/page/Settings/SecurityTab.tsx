import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, X } from "lucide-react";
import { Button, Input, useToast } from "../../components/ui";
import PasswordInput from "../../components/auth/PasswordInput";
import { toApiError } from "../../api/errors";
import { authApi } from "../../api/authApi";
import { PASSWORD_RULES, isStrongPassword, passwordScore, strengthLabel } from "../../lib/passwordRules";

/**
 * Security tab: change the password via `POST /auth/change-password`.
 * The current one is verified server-side (422 = wrong current password);
 * a success revokes every refresh token, so any other device must sign in again.
 */
const schema = z
  .object({
    current: z.string().min(1, "Enter your current password."),
    next: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(72, "Password is too long.")
      .refine(isStrongPassword, "Password doesn't meet all the requirements below."),
    confirm: z.string().min(1, "Confirm the new password."),
  })
  .refine((v) => v.next !== v.current, {
    path: ["next"],
    message: "The new password must differ from the current one.",
  })
  .refine((v) => v.confirm === v.next, {
    path: ["confirm"],
    message: "Passwords don't match.",
  });

type SecurityFormValues = z.infer<typeof schema>;

export default function SecurityTab() {
  const [formError, setFormError] = useState<string | null>(null);
  const toast = useToast();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SecurityFormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { current: "", next: "", confirm: "" },
  });

  // Live strength meter for the new-password field.
  const nextValue = watch("next");
  const score = passwordScore(nextValue);
  const strength = strengthLabel(score);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await authApi.changePassword({ currentPassword: values.current, newPassword: values.next });
      reset({ current: "", next: "", confirm: "" });
      toast.success(
        "Password changed",
        "Your new password is active from now on. Any other device signed into this account will need to sign in again.",
      );
    } catch (err) {
      const apiError = toApiError(err);
      // 422 is the contract's "wrong current password" answer — pin it to that field.
      if (apiError.status === 422) {
        setError("current", { type: "server", message: "Your current password is incorrect." });
        return;
      }
      setFormError(apiError.message);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="rounded-control border border-line bg-surface p-5 sm:p-6">
        <h2 className="text-base font-bold">Change password</h2>
        <p className="mt-1 text-sm text-muted">Choose a strong password you haven't used before.</p>

        {formError && (
          <div role="alert" className="mt-4 rounded-control border border-danger-600/20 bg-danger-50 px-3 py-2 text-sm text-danger-700">
            {formError}
          </div>
        )}

        <div className="mt-5 grid max-w-md gap-4">
          <div>
            <label htmlFor="settings-current" className="mb-1 block text-xs font-semibold text-muted">
              Current password
            </label>
            <Input
              id="settings-current"
              type="password"
              {...register("current")}
              autoComplete="current-password"
              aria-invalid={!!errors.current}
              placeholder="••••••••"
            />
            {errors.current && (
              <p role="alert" className="mt-1 text-xs font-medium text-danger-700">
                {errors.current.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="settings-next" className="mb-1 block text-xs font-semibold text-muted">
              New password
            </label>
            <PasswordInput
              id="settings-next"
              {...register("next")}
              autoComplete="new-password"
              aria-invalid={!!errors.next}
              placeholder="Create a strong password"
            />
            {errors.next && (
              <p role="alert" className="mt-1 text-xs font-medium text-danger-700">
                {errors.next.message}
              </p>
            )}

            <div className="mt-3" aria-live="polite">
              <div className="flex gap-1.5" aria-hidden="true">
                {PASSWORD_RULES.map((rule, i) => (
                  <span
                    key={rule.id}
                    className={`h-1.5 flex-1 rounded-full transition-colors duration-300 motion-reduce:transition-none ${
                      i < score && nextValue ? strength.tone : "bg-slate-200"
                    }`}
                  />
                ))}
              </div>
              <p className="mt-1.5 text-xs text-muted">
                {nextValue ? (
                  <>
                    Password strength: <span className="font-semibold text-ink">{strength.label}</span>
                  </>
                ) : (
                  "Your password must meet all of these rules:"
                )}
              </p>
            </div>

            <ul className="mt-2 grid gap-1.5 sm:grid-cols-2" aria-label="Rules for your new password">
              {PASSWORD_RULES.map((rule) => {
                const met = rule.test(nextValue);
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
                      {met ? <Check className="h-3 w-3" strokeWidth={3} /> : <X className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    {rule.label}
                    <span className="sr-only">{met ? " — met" : " — not met yet"}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <label htmlFor="settings-confirm" className="mb-1 block text-xs font-semibold text-muted">
              Confirm new password
            </label>
            <PasswordInput
              id="settings-confirm"
              {...register("confirm")}
              autoComplete="new-password"
              aria-invalid={!!errors.confirm}
              placeholder="Repeat the new password"
            />
            {errors.confirm && (
              <p role="alert" className="mt-1 text-xs font-medium text-danger-700">
                {errors.confirm.message}
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <Button type="submit" loading={isSubmitting}>
            Change password
          </Button>
        </div>
      </div>
    </form>
  );
}
