import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, Lock, ShieldCheck } from "lucide-react";
import { Button, IconBadge, Input, useToast } from "../../components/ui";
import { toApiError } from "../../api/errors";
import { useAuth } from "../../context/auth/useAuth";

/** Only `name` is editable — PATCH /auth/me rejects email/role (admin-managed). */
const schema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(100, "Name is too long."),
});

type ProfileFormValues = z.infer<typeof schema>;

/** Read-only detail tile — the same look as the profile page's DetailTile. */
function ReadOnlyTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-control border border-line bg-surface-alt px-4 py-3.5">
      <IconBadge className="size-10 shrink-0">{icon}</IconBadge>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
        <p className="truncate text-sm font-semibold text-ink">{value}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
    </div>
  );
}

/**
 * Profile tab: edit the display name; email and role are shown read-only
 * because only an administrator can change them (contract §3.1).
 */
export default function ProfileTab() {
  const { user, updateProfile } = useAuth();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { name: user?.name ?? "" },
  });

  if (!user) return null;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    if (values.name === user.name) {
      toast.info("Nothing to save", "The name is already up to date.");
      return;
    }

    try {
      await updateProfile({ name: values.name });
      reset({ name: values.name });
      toast.success("Profile updated", "Your display name has been saved.");
    } catch (err) {
      setFormError(toApiError(err).message);
    }
  });

  const roleLabel = user.role === "ADMIN" ? "Admin" : "Staff";

  return (
    <div className="space-y-5">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div className="rounded-control border border-line bg-surface p-5 sm:p-6">
          <h2 className="text-base font-bold">Personal information</h2>
          <p className="mt-1 text-sm text-muted">Update your display name. It appears across the app.</p>

          {formError && (
            <div role="alert" className="mt-4 rounded-control border border-danger-600/20 bg-danger-50 px-3 py-2 text-sm text-danger-700">
              {formError}
            </div>
          )}

          <div className="mt-5 max-w-md">
            <label htmlFor="settings-name" className="mb-1 block text-xs font-semibold text-muted">
              Full name
            </label>
            <Input
              id="settings-name"
              {...register("name")}
              autoComplete="name"
              aria-invalid={!!errors.name}
              placeholder="Your name"
            />
            {errors.name && (
              <p role="alert" className="mt-1 text-xs font-medium text-danger-700">
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="mt-5 flex items-center gap-3">
            <Button type="submit" loading={isSubmitting}>
              Save changes
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={isSubmitting}
              onClick={() => {
                reset({ name: user.name });
                setFormError(null);
              }}
            >
              Reset
            </Button>
          </div>
        </div>
      </form>

      <div className="rounded-control border border-line bg-surface p-5 sm:p-6">
        <h2 className="text-base font-bold">Account information</h2>
        <p className="mt-1 text-sm text-muted">These fields can only be changed by an administrator.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <ReadOnlyTile icon={<Mail className="size-5" />} label="Email address" value={user.email} />
          <ReadOnlyTile
            icon={<ShieldCheck className="size-5" />}
            label="Account role"
            value={roleLabel}
            hint="Managed by an administrator"
          />
        </div>

        <p className="mt-3 flex items-start gap-1.5 text-xs text-muted">
          <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          Changing your email or role requires an administrator — you can edit only your name here.
        </p>
      </div>
    </div>
  );
}
