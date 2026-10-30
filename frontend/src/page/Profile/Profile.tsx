import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CalendarDays,
  CircleCheck,
  LogOut,
  Mail,
  Pencil,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  UserRound,
  ReceiptText,
  Upload,
} from "lucide-react";
import { Badge, Button, Card, ConfirmDialog, IconBadge, useToast } from "../../components/ui";
import UserAvatar from "../../components/user/UserAvatar";
import { useAuth } from "../../context/auth/useAuth";
import { useMyOrders } from "../../features/orders/hooks";
import OrderStatusBadge from "../../features/orders/StatusBadge";
import { formatDate, formatMoney, formatNumber, orderPath } from "../../features/orders/format";
import type { MyOrderListParams } from "../../features/orders/types";
import ImageUploadField from "../../features/products/ImageUploadField";
import { AVATAR_RULES } from "../../features/users/avatar";
import EditProfileDialog from "./EditProfileDialog";

/** Shared row dimensions for the order-history list. */
const RECENT_ORDERS_PAGE_SIZE = 5;

const joined = (iso?: string) => {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString(undefined, { year: "numeric", month: "long" });
};

/**
 * Small labelled cell in the "Account details" grid — soft icon square on
 * the left, label + value on the right, like the reference design.
 */
function DetailTile({
  icon,
  label,
  value,
  hint,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-control border border-line bg-surface-alt px-4 py-3.5 ${className ?? ""}`}
    >
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
 * Account hub — styled after the reference profile card: gradient hero with
 * the name, avatar, account detail tiles, order history and the destructive
 * "delete account" zone. Every button performs a real action:
 *
 *   Edit profile → PATCH /auth/me (name and/or password) via the modal
 *   My products  → the shop product list at /products
 *   Log out      → signs the session out
 *   Delete       → DELETE /auth/me (self-deactivation endpoint)
 */
export default function Profile() {
  const { user, logout, deleteAccount, hasRole, uploadAvatar, removeAvatar } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const isAdmin = hasRole("ADMIN");
  const isCustomer = hasRole("CUSTOMER");

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarRemoveOpen, setAvatarRemoveOpen] = useState(false);
  const [avatarRemoving, setAvatarRemoving] = useState(false);

  // Stable param object — the query key embeds it.
  const orderParams = useMemo<MyOrderListParams>(
    () => ({ status: "", page: 1, pageSize: RECENT_ORDERS_PAGE_SIZE }),
    [],
  );
  const ordersQuery = useMyOrders(orderParams, { enabled: isCustomer });

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

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  const handleAvatarUpload = async () => {
    if (!avatarFile) return;
    setAvatarUploading(true);
    try {
      await uploadAvatar(avatarFile);
      setAvatarFile(null);
      toast.success("Avatar updated", "Your new profile photo is now live.");
    } catch (err) {
      toast.error("Couldn't upload the avatar", err instanceof Error ? err.message : undefined);
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleAvatarRemove = async () => {
    setAvatarRemoving(true);
    try {
      await removeAvatar();
      setAvatarFile(null);
      setAvatarRemoveOpen(false);
      toast.success("Avatar removed", "Your initials will be shown instead.");
    } catch (err) {
      setAvatarRemoveOpen(false);
      toast.error("Couldn't remove the avatar", err instanceof Error ? err.message : undefined);
    } finally {
      setAvatarRemoving(false);
    }
  };

  /** A picked file is dropped locally; the saved avatar asks for confirmation. */
  const handleAvatarFieldRemove = () => {
    if (avatarFile) {
      setAvatarFile(null);
      return;
    }
    if (user?.avatarUrl) setAvatarRemoveOpen(true);
  };

  if (!user) return null;

  const since = joined(user.createdAt);
  const orders = ordersQuery.data?.items ?? [];

  return (
    <div className="min-h-[calc(100vh-128px)] bg-surface-alt py-10 text-ink">
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
        <Card className="overflow-hidden">
          {/* Hero band — name over the brand gradient, avatar overlapping. */}
          <div className="relative bg-gradient-to-r from-primary-600 via-primary-500 to-primary-400 px-6 pb-16 pt-10 sm:px-10">
            <h1 className="text-2xl font-extrabold text-white sm:text-3xl">{user.name}</h1>
            <UserAvatar
              name={user.name}
              src={user.avatarUrl}
              size="xl"
              className="absolute -bottom-12 left-6 bg-surface shadow-lg ring-4 ring-primary-100/70 sm:left-10"
            />
          </div>

          <div className="px-6 pb-8 sm:px-10">
            {/* Contact row under the avatar. */}
            <div className="pl-0 pt-5 sm:pl-32">
              <p className="text-sm text-muted">{user.email}</p>
              <Badge tone="primary" dot className="mt-2 uppercase tracking-widest">
                {user.role}
              </Badge>
            </div>

            <h2 className="mt-9 text-lg font-bold">Profile photo</h2>
            <div className="mt-1.5 h-px bg-line" />

            <div className="mt-5 space-y-3">
              <ImageUploadField
                currentUrl={user.avatarUrl}
                file={avatarFile}
                onFileSelect={setAvatarFile}
                onRemove={handleAvatarFieldRemove}
                disabled={avatarUploading || avatarRemoving}
                loading={avatarUploading}
                rules={AVATAR_RULES}
                label="Avatar"
                hint="JPEG, PNG or WebP — up to 1 MB."
                previewAlt="Avatar preview"
                previewClassName="size-24 rounded-full"
                helperText={null}
                chooseLabel="Choose avatar"
                changeLabel="Change avatar"
                removeLabel="Remove avatar"
                loadingLabel="Uploading…"
              />
              {avatarFile && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    leftIcon={<Upload className="size-4" aria-hidden="true" />}
                    loading={avatarUploading}
                    onClick={() => void handleAvatarUpload()}
                  >
                    Upload avatar
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={avatarUploading}
                    onClick={() => setAvatarFile(null)}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>

            <h2 className="mt-9 text-lg font-bold">Account details</h2>
            <div className="mt-1.5 h-px bg-line" />

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <DetailTile icon={<UserRound className="size-5" />} label="Full name" value={user.name} className="sm:col-span-2" />
              <DetailTile icon={<Mail className="size-5" />} label="Email address" value={user.email} />
              <DetailTile
                icon={<ShieldCheck className="size-5" />}
                label="Account role"
                value={isAdmin ? "Admin" : "Staff"}
                hint="Managed by an administrator"
              />
              <DetailTile
                icon={<CalendarDays className="size-5" />}
                label="Member since"
                value={since ?? "—"}
                hint={since ? undefined : "Sign in again to load it"}
              />
              <DetailTile icon={<CircleCheck className="size-5" />} label="Account status" value="Active" />
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button leftIcon={<Pencil className="size-4" aria-hidden="true" />} onClick={() => setEditOpen(true)}>
                Edit profile
              </Button>
              <Link to="/products" className="inline-flex">
                <Button variant="secondary" leftIcon={<ShoppingBag className="size-4" aria-hidden="true" />}>
                  My products
                </Button>
              </Link>
              {isCustomer && (
                <Link to="/orders" className="inline-flex">
                  <Button variant="secondary" leftIcon={<ReceiptText className="size-4" aria-hidden="true" />}>
                    My orders
                  </Button>
                </Link>
              )}
              <Button variant="ghost" className="text-danger-600 hover:text-danger-700" leftIcon={<LogOut className="size-4 " aria-hidden="true"  />} onClick={() => void handleLogout()}>
                Log out
              </Button>
            </div>

            {isCustomer && (
              <>
                <h2 className="mt-9 text-lg font-bold">Order history</h2>
                <div className="mt-1.5 h-px bg-line" />

                {ordersQuery.isPending ? (
                  <ul className="mt-5 space-y-3" aria-hidden="true">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <li key={i} className="h-14 animate-pulse rounded-control border border-line bg-surface-alt" />
                    ))}
                  </ul>
                ) : ordersQuery.isError ? (
                  <div className="mt-5 rounded-control border border-dashed border-danger-600/30 bg-danger-50 px-4 py-8 text-center text-sm text-danger-700">
                    Couldn't load your orders. Please try again later.
                  </div>
                ) : orders.length === 0 ? (
                  <div className="mt-5 rounded-control border border-dashed border-line bg-surface-alt px-4 py-10 text-center text-sm text-muted">
                    No orders found.
                  </div>
                ) : (
                  <ul className="mt-5 space-y-3">
                    {orders.map((order) => (
                      <li
                        key={String(order.id)}
                        className="rounded-control border border-line bg-surface-alt px-4 py-3 transition hover:border-primary-300"
                      >
                        <Link to={orderPath(order.id)} className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-mono text-sm font-bold text-ink">{formatNumber(order.orderNumber)}</p>
                            <p className="text-xs text-muted">{formatDate(order.createdAt)}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-ink">{formatMoney(order.totalAmount)}</span>
                            <OrderStatusBadge status={order.status} />
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {/* Destructive zone — kept visually apart, guarded by a confirm dialog. */}
            <div className="mt-9 flex flex-wrap items-center justify-between gap-4 rounded-control border border-danger-600/20 bg-danger-50 px-5 py-4">
              <div>
                <p className="text-sm font-bold text-danger-700">Delete account</p>
                <p className="text-xs text-danger-700/80">
                  Permanently remove your account. This can't be undone.
                </p>
              </div>
              <Button variant="secondary" leftIcon={<Trash2 className="size-4" aria-hidden="true" />} onClick={() => setDeleteOpen(true)}>
                Delete
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <EditProfileDialog open={editOpen} onClose={() => setEditOpen(false)} />

      <ConfirmDialog
        open={avatarRemoveOpen}
        title="Remove profile photo?"
        description="Your initials will be shown instead until you upload a new photo."
        confirmLabel="Remove"
        loading={avatarRemoving}
        onConfirm={() => void handleAvatarRemove()}
        onCancel={() => setAvatarRemoveOpen(false)}
      />

      <ConfirmDialog
        open={deleteOpen}
        title="Delete account?"
        description="Your account will be deactivated and signed out everywhere. Administrators can re-enable it, but data access ends immediately."
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
