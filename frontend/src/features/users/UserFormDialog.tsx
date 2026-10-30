import { useState } from "react";
import { ApiError } from "../../lib/http";
import { Button, Input, Modal, useToast } from "../../components/ui";
import { useCreateUser, useUpdateUser } from "./hooks";
import type { AdminUser, UserRole } from "./types";
import { ROLES, ROLE_LABELS } from "../../types/auth";

const ROLE_HINTS: Record<UserRole, string> = {
  ADMIN: "Full access, users and audit",
  STAFF: "Orders, products and inventory",
  SUPPORT: "Support inbox and order help",
  CUSTOMER: "Storefront, cart and own orders",
};

type FormField = "name" | "email" | "password" | "role";
type FieldErrors = Partial<Record<FormField, string>>;

/** The backend validates passwords with IsByteLength(8, 72), not string length. */
const byteLength = (value: string) => new TextEncoder().encode(value).length;

const fieldError = (message?: string) =>
  message ? (
    <p role="alert" className="mt-1 text-xs font-medium text-danger-700">
      {message}
    </p>
  ) : null;

/**
 * Create/edit user (ADMIN). Creation sets name, email, the initial
 * password and a role; editing updates name/email/role (passwords change
 * through the dedicated account flow, not here). Server rules still
 * apply: admins cannot demote or deactivate themselves, and the last
 * active ADMIN can never lose its status (409).
 */
export default function UserFormDialog({ user, onClose }: { user: AdminUser | null; onClose: () => void }) {
  const editing = user !== null;
  const toast = useToast();
  const create = useCreateUser();
  const update = useUpdateUser();

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState<UserRole>(user?.role ?? "STAFF");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const saving = create.isPending || update.isPending;
  const close = () => {
    if (!saving) onClose();
  };

  const nameInvalid = name.trim().length < 2;
  const emailInvalid = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  // Password is only asked at creation; §3.2 keeps updates password-free.
  const passwordBytes = byteLength(password);
  const passwordInvalid = !editing && (passwordBytes < 8 || passwordBytes > 72);
  const valid = !nameInvalid && !emailInvalid && !passwordInvalid;

  const clearFieldError = (field: FormField) =>
    setFieldErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));

  const submit = async () => {
    setFormError(null);
    setFieldErrors({});
    try {
      if (editing) {
        // Only send the role when the admin actually changed it.
        const patch = { name: name.trim(), email: email.trim(), ...(role !== user.role ? { role } : {}) };
        await update.mutateAsync({ id: user.id, patch });
        toast.success("User updated", `${name.trim()} was saved.`);
      } else {
        const created = await create.mutateAsync({ name: name.trim(), email: email.trim(), role, password });
        toast.success("User created", `${created.name} can sign in with the password you set.`);
      }
      onClose();
    } catch (err) {
      if (!(err instanceof ApiError)) {
        setFormError(err instanceof Error ? err.message : "Something went wrong");
        return;
      }

      const mapped: FieldErrors = {};
      for (const field of ["name", "email", "password", "role"] as const) {
        const message = err.fieldErrors[field];
        if (message) mapped[field] = message;
      }
      setFieldErrors(mapped);

      // 409 (last active ADMIN) and 422 (self-protection) carry a server
      // message that is not tied to a single field.
      setFormError(err.serverMessage ?? (Object.keys(mapped).length > 0 ? null : err.message));
    }
  };

  return (
    <Modal
      open
      onClose={close}
      title={editing ? "Edit user" : "New user"}
      description={
        editing
          ? "Update the account details or change the user's role. At least one active admin must remain."
          : "Create an account that can sign in, with a role that decides what it may do."
      }
      size="sm"
      dismissible={!saving}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => void submit()} loading={saving} disabled={!valid}>
            {editing ? "Save changes" : "Create user"}
          </Button>
        </>
      }
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        noValidate
      >
        {formError && (
          <div role="alert" className="rounded-control border border-danger-600/20 bg-danger-50 px-3 py-2 text-[13px] text-danger-700">
            {formError}
          </div>
        )}

        <div>
          <label htmlFor="u-name" className="mb-1 block text-[11px] font-semibold text-[#374151]">
            Full name *
          </label>
          <Input
            id="u-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              clearFieldError("name");
            }}
            invalid={nameInvalid || !!fieldErrors.name}
            autoComplete="off"
            placeholder="e.g. Sara Martinez"
            className="h-9 text-[13px]"
          />
          {fieldError(fieldErrors.name)}
        </div>

        <div>
          <label htmlFor="u-email" className="mb-1 block text-[11px] font-semibold text-[#374151]">
            Email *
          </label>
          <Input
            id="u-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearFieldError("email");
            }}
            invalid={emailInvalid || !!fieldErrors.email}
            autoComplete="off"
            placeholder="sara@company.com"
            className="h-9 text-[13px]"
          />
          {fieldError(fieldErrors.email)}
        </div>

        <div>
          <span className="mb-1 block text-[11px] font-semibold text-[#374151]">Role *</span>
          <div className="grid grid-cols-2 gap-2">
            {ROLES.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={role === r}
                onClick={() => {
                  setRole(r);
                  clearFieldError("role");
                }}
                className={`rounded-lg border px-3 py-2 text-left text-[13px] transition ${
                  role === r ? "border-[#FF5615] bg-[#FFF1EB] text-[#111827]" : "border-[#E5E7EB] bg-white text-[#374151] hover:border-[#FCA98E]"
                }`}
              >
                <span className="block font-semibold">{ROLE_LABELS[r]}</span>
                <span className="block text-[11px] text-[#6B7280]">{ROLE_HINTS[r]}</span>
              </button>
            ))}
          </div>
          {fieldError(fieldErrors.role)}
        </div>

        {!editing && (
          <div>
            <label htmlFor="u-password" className="mb-1 block text-[11px] font-semibold text-[#374151]">
              Initial password *
            </label>
            <Input
              id="u-password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearFieldError("password");
              }}
              invalid={passwordInvalid || !!fieldErrors.password}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              className="h-9 text-[13px]"
            />
            {passwordInvalid && password.length > 0 && (
              <p className="mt-1 text-xs font-medium text-danger-700">Use at least 8 characters (max 72 bytes).</p>
            )}
            {fieldError(fieldErrors.password)}
            <p className="mt-0.5 text-[11px] text-[#9CA3AF]">Share it with the user; they can change it later in their profile.</p>
          </div>
        )}
      </form>
    </Modal>
  );
}
