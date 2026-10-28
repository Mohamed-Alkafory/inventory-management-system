import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ApiError } from "../../lib/http";
import { Button, Modal, useToast } from "../../components/ui";
import { useAuth } from "../../context/auth/useAuth";
import { Input } from "../../components/ui";

/**
 * Modal for the "Edit profile" button: the fields `PATCH /auth/me` accepts
 * (`name` plus an optional nested password change — email/role stay
 * ADMIN-managed). Password changes also revoke every refresh token, so the
 * other devices go through the sign-in screen again on their next refresh.
 */
const schema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters.").max(100, "Name is too long."),
    current: z.string().optional(),
    next: z.string().optional(),
    confirm: z.string().optional(),
  })
  .refine((v) => !v.next || (v.current ?? "").length > 0, {
    path: ["current"],
    message: "Enter your current password to change it.",
  })
  .refine((v) => !v.next || v.next.length >= 8, {
    path: ["next"],
    message: "Password must be at least 8 characters.",
  })
  .refine((v) => !v.next || v.next === v.confirm, {
    path: ["confirm"],
    message: "Passwords don't match.",
  });

type ProfileFormValues = z.infer<typeof schema>;

/** Server field name → form field name. */
const ALIASES: Record<string, keyof ProfileFormValues> = {
  name: "name",
  current: "current",
  password: "next",
  newPassword: "next",
  newPasswordConfirm: "confirm",
};

export default function EditProfileDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, updateProfile } = useAuth();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { name: user?.name ?? "", current: "", next: "", confirm: "" },
  });

  if (!user) return null;

  const close = () => {
    reset({ name: user.name, current: "", next: "", confirm: "" });
    setFormError(null);
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const nameChanged = values.name !== user.name;
    const passwordChanged = !!values.next;
    const payload: Parameters<typeof updateProfile>[0] = {
      ...(nameChanged ? { name: values.name } : {}),
      ...(passwordChanged ? { password: { current: values.current!, next: values.next! } } : {}),
    };

    if (!nameChanged && !passwordChanged) {
      toast.info("Nothing to save", "No changes were made to your profile.");
      close();
      return;
    }

    try {
      await updateProfile(payload);
      if (passwordChanged) {
        toast.warning("Password changed", "Signed-in devices will need to sign in again.");
      }
      toast.success("Profile updated", "Your changes have been saved.");
      close();
    } catch (err) {
      if (err instanceof ApiError) {
        const mapped: Partial<Record<keyof ProfileFormValues, string>> = {};
        for (const [k, msg] of Object.entries(err.fieldErrors)) {
          const f = ALIASES[k];
          if (f && !mapped[f]) mapped[f] = msg;
        }
        const fields = (["name", "current", "next", "confirm"] as const).filter((f) => mapped[f]);
        fields.forEach((f) => setError(f, { type: "server", message: mapped[f] }));
        if (fields.length === 0) setFormError(err.serverMessage ?? err.message);
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    }
  });

  return (
    <Modal
      open={open}
      onClose={close}
      title="Edit profile"
      description="Update your display name or change your password."
      dismissible={!isSubmitting}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="edit-profile-form" loading={isSubmitting}>
            Save changes
          </Button>
        </>
      }
    >
      <form id="edit-profile-form" onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && (
          <div role="alert" className="rounded-control border border-danger-600/20 bg-danger-50 px-3 py-2 text-sm text-danger-700">
            {formError}
          </div>
        )}

        <label htmlFor="profile-name" className="block text-xs font-semibold uppercase tracking-wide text-muted">
          Full name
        </label>
        <Input
          id="profile-name"
          {...register("name")}
          autoFocus
          autoComplete="name"
          aria-invalid={!!errors.name}
          placeholder="Your name"
        />
        {errors.name && (
          <p role="alert" className="text-xs font-medium text-danger-700">
            {errors.name.message}
          </p>
        )}

        <div className="border-t border-line pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Change password (optional)</p>
        </div>

        <div className="grid gap-4">
          <div>
            <label htmlFor="profile-current" className="mb-1 block text-xs font-semibold text-muted">
              Current password
            </label>
            <Input
              id="profile-current"
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
            <label htmlFor="profile-next" className="mb-1 block text-xs font-semibold text-muted">
              New password
            </label>
            <Input
              id="profile-next"
              type="password"
              {...register("next")}
              autoComplete="new-password"
              aria-invalid={!!errors.next}
              placeholder="At least 8 characters"
            />
            {errors.next && (
              <p role="alert" className="mt-1 text-xs font-medium text-danger-700">
                {errors.next.message}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="profile-confirm" className="mb-1 block text-xs font-semibold text-muted">
              Confirm new password
            </label>
            <Input
              id="profile-confirm"
              type="password"
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

        <p className="text-xs text-muted">
          Your email address and account role are managed by an administrator.
        </p>
      </form>
    </Modal>
  );
}
