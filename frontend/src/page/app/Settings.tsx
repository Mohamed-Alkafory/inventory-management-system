import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { KeyRound, Mail, ShieldCheck, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  FormField,
  Input,
  useToast,
} from "../../components/ui";
import { useAuth } from "../../context/auth/useAuth";
import NotificationPreferences from "../../features/notifications/NotificationPreferences";
import { useArea } from "../../routes/useArea";
import { ApiError } from "../../lib/http";

const nameSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(100, "Name is too long."),
});

type NameValues = z.infer<typeof nameSchema>;

const passwordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password."),
    next: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(72, "Password must be at most 72 characters."),
    confirm: z.string().min(1, "Confirm your new password."),
  })
  .refine((values) => values.next === values.confirm, {
    path: ["confirm"],
    message: "Passwords don't match.",
  });

type PasswordValues = z.infer<typeof passwordSchema>;

/** Server field name → form field name. */
const PASSWORD_FIELD_ALIASES: Record<string, keyof PasswordValues> = {
  current: "current",
  currentPassword: "current",
  password: "next",
  newPassword: "next",
  next: "next",
  confirm: "confirm",
  newPasswordConfirm: "confirm",
};

export default function Settings() {
  const { user, updateProfile, deleteAccount } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  // Inside a dashboard shell the layout owns the page background and padding.
  const inArea = useArea() !== null;

  const [formError, setFormError] = useState<string | null>(null);

  const nameForm = useForm<NameValues>({
    resolver: zodResolver(nameSchema),
    mode: "onTouched",
    defaultValues: { name: user?.name ?? "" },
  });

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    mode: "onTouched",
    defaultValues: { current: "", next: "", confirm: "" },
  });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!user) return null;

  const onSaveName = nameForm.handleSubmit(async (values) => {
    setFormError(null);
    if (values.name === user.name) {
      toast.info("Nothing to save", "Your display name is already up to date.");
      return;
    }

    try {
      await updateProfile({ name: values.name });
      toast.success("Settings saved", "Your display name has been updated.");
    } catch (err) {
      if (err instanceof ApiError) {
        const message = err.fieldErrors.name ?? err.serverMessage ?? err.message;
        nameForm.setError("name", { type: "server", message });
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    }
  });

  const onChangePassword = passwordForm.handleSubmit(async (values) => {
    setFormError(null);

    try {
      await updateProfile({ password: { current: values.current, next: values.next } });
      passwordForm.reset();
      toast.warning("Password changed", "Other signed-in devices will need to sign in again.");
    } catch (err) {
      if (err instanceof ApiError) {
        const mapped: Partial<Record<keyof PasswordValues, string>> = {};
        for (const [key, message] of Object.entries(err.fieldErrors)) {
          const field = PASSWORD_FIELD_ALIASES[key.split(".").pop() ?? key];
          if (field && !mapped[field]) mapped[field] = message;
        }
        const fields = (["current", "next", "confirm"] as const).filter((field) => mapped[field]);
        fields.forEach((field) => passwordForm.setError(field, { type: "server", message: mapped[field] }));
        if (fields.length === 0) setFormError(err.serverMessage ?? err.message);
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    }
  });

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteAccount();
      toast.warning("Account deleted", "Your account has been permanently removed.");
      navigate("/", { replace: true });
    } catch (err) {
      setDeleting(false);
      setDeleteOpen(false);
      toast.error("Couldn't delete the account", err instanceof Error ? err.message : undefined);
    }
  };

  return (
    <div className={inArea ? undefined : "min-h-[calc(100vh_-_var(--header-h))] bg-surface-alt py-10 text-ink"}>
      <div className="mx-auto w-full max-w-3xl space-y-6 px-4 sm:px-6">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">Settings</h1>
          <p className="mt-1 text-sm text-muted">
            Manage your account details, password and notification preferences.
          </p>
        </div>

        {formError && (
          <div
            role="alert"
            className="rounded-control border border-danger-600/20 bg-danger-50 px-4 py-3 text-sm text-danger-700"
          >
            {formError}
          </div>
        )}

        <Card>
          <CardHeader title="Account" description="Your sign-in details and display name." />
          <CardBody className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-control border border-line bg-surface-alt px-4 py-3">
                <Mail className="size-5 shrink-0 text-muted" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Email</p>
                  <p className="truncate text-sm font-semibold">{user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-control border border-line bg-surface-alt px-4 py-3">
                <ShieldCheck className="size-5 shrink-0 text-muted" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Role</p>
                  <Badge tone="primary" className="mt-0.5 uppercase tracking-widest">
                    {user.role}
                  </Badge>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted">
              Your email address and role are managed by an administrator.
            </p>

            <form onSubmit={onSaveName} noValidate className="space-y-4 border-t border-line pt-5">
              <FormField control={nameForm.control} name="name" label="Display name" required>
                {({ field, aria }) => (
                  <Input
                    {...field}
                    {...aria}
                    autoComplete="name"
                    placeholder="Your name"
                  />
                )}
              </FormField>
              <Button type="submit" loading={nameForm.formState.isSubmitting}>
                Save name
              </Button>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Password"
            description="Use at least 8 characters. Changing it signs out your other devices."
          />
          <CardBody>
            <form onSubmit={onChangePassword} noValidate className="space-y-4">
              <FormField control={passwordForm.control} name="current" label="Current password" required>
                {({ field, aria }) => (
                  <Input {...field} {...aria} type="password" autoComplete="current-password" placeholder="••••••••" />
                )}
              </FormField>
              <FormField control={passwordForm.control} name="next" label="New password" required>
                {({ field, aria }) => (
                  <Input
                    {...field}
                    {...aria}
                    type="password"
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                  />
                )}
              </FormField>
              <FormField control={passwordForm.control} name="confirm" label="Confirm new password" required>
                {({ field, aria }) => (
                  <Input
                    {...field}
                    {...aria}
                    type="password"
                    autoComplete="new-password"
                    placeholder="Repeat the new password"
                  />
                )}
              </FormField>
              <Button
                type="submit"
                loading={passwordForm.formState.isSubmitting}
                leftIcon={<KeyRound className="size-4" aria-hidden="true" />}
              >
                Change password
              </Button>
            </form>
          </CardBody>
        </Card>

        <NotificationPreferences />

        <Card className="border-danger-600/30">
          <CardHeader
            title="Danger zone"
            description="Deactivating your account signs you out and can't be undone from here."
            action={<Badge tone="danger">Irreversible</Badge>}
          />
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Delete account</p>
              <p className="text-xs text-muted">You will lose access to your orders and saved items.</p>
            </div>
            <Button
              variant="danger"
              leftIcon={<Trash2 className="size-4" aria-hidden="true" />}
              onClick={() => setDeleteOpen(true)}
            >
              Delete account
            </Button>
          </CardBody>
        </Card>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete your account?"
        description="This deactivates your account permanently. You will be signed out immediately."
        confirmLabel="Delete account"
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
