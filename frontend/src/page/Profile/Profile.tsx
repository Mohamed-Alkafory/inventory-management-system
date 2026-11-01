import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  CircleCheck,
  LogOut,
  Mail,
  Pencil,
  ReceiptText,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { Badge, Button, Card, CardBody, CardHeader, ConfirmDialog, IconBadge, useToast } from "../../components/ui";
import UserAvatar from "../../components/user/UserAvatar";
import { useAuth } from "../../context/auth/useAuth";
import { useMyOrders } from "../../features/orders/hooks";
import OrderStatusBadge from "../../features/orders/StatusBadge";
import { formatDate, formatMoney, formatNumber, orderPath } from "../../features/orders/format";
import type { MyOrderListParams } from "../../features/orders/types";
import ImageUploadField from "../../features/products/ImageUploadField";
import { AVATAR_RULES } from "../../features/users/avatar";
import { useArea } from "../../routes/useArea";
import { useAreaLinks } from "../../routes/useAreaLinks";
import { ROLE_LABELS } from "../../types/auth";
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
 * the left, label + value on the right.
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

/** Row link in the sidebar "Quick links" card. */
function QuickLink({ to, icon: Icon, children }: { to: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-semibold text-muted transition-colors hover:bg-surface-alt hover:text-ink"
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {children}
    </Link>
  );
}

/**
 * Account hub: a sticky identity sidebar beside the editable profile content.
 * Every button performs a real action:
 *
 *   Edit profile → PATCH /auth/me (name and/or password) via the modal
 *   My products  → the product list for the current dashboard area
 *   Log out      → signs the session out
 *   Delete       → DELETE /auth/me (self-deactivation endpoint)
 */
export default function Profile() {
  const { user, logout, deleteAccount, hasRole, uploadAvatar, removeAvatar } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const links = useAreaLinks();
  const isCustomer = hasRole("CUSTOMER");
  // Inside a dashboard shell the layout owns the page background and padding.
  const inArea = useArea() !== null;

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
    <div
      className={
        inArea ? undefined : "min-h-[calc(100vh_-_var(--header-h))] bg-surface-alt py-8 text-ink sm:py-10"
      }
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] xl:grid-cols-[22rem_minmax(0,1fr)]">
          {/* ================= Sidebar ================= */}
          <aside className="space-y-6 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)] lg:self-start">
            <Card className="overflow-hidden">
              {/* Cover band + overlapping avatar */}
              <div className="relative h-28 bg-gradient-to-br from-primary-600 via-primary-500 to-primary-400">
                <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:16px_16px]" />
              </div>

              <div className="px-5 pb-5">
                <div className="relative z-10 -mt-12 flex justify-center">
                  <UserAvatar
                    name={user.name}
                    src={user.avatarUrl}
                    size="xl"
                    className="bg-surface shadow-lg ring-4 ring-surface"
                  />
                </div>

                <div className="mt-3 text-center">
                  <h1 className="truncate text-xl font-extrabold text-ink">{user.name}</h1>
                  <p className="mt-0.5 truncate text-sm text-muted">{user.email}</p>
                  <Badge tone="primary" dot className="mt-2 uppercase tracking-widest">
                    {ROLE_LABELS[user.role]}
                  </Badge>
                </div>

                <div className="mt-5 grid grid-cols-2 divide-x divide-line rounded-control border border-line bg-surface-alt text-center">
                  <div className="px-2 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Member since</p>
                    <p className="mt-0.5 text-sm font-semibold text-ink">{since ?? "—"}</p>
                  </div>
                  <div className="px-2 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Status</p>
                    <p className="mt-0.5 text-sm font-semibold text-success-700">Active</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  <Button
                    fullWidth
                    leftIcon={<Pencil className="size-4" aria-hidden="true" />}
                    onClick={() => setEditOpen(true)}
                  >
                    Edit profile
                  </Button>
                  <Button
                    fullWidth
                    variant="ghost"
                    className="text-danger-600 hover:text-danger-700"
                    leftIcon={<LogOut className="size-4" aria-hidden="true" />}
                    onClick={() => void handleLogout()}
                  >
                    Log out
                  </Button>
                </div>
              </div>
            </Card>

            <Card>
              <CardBody className="p-2">
                <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Quick links
                </p>
                <nav className="flex flex-col">
                  <QuickLink to={links.products} icon={ShoppingBag}>
                    My products
                  </QuickLink>
                  {isCustomer && (
                    <QuickLink to={links.orders} icon={ReceiptText}>
                      My orders
                    </QuickLink>
                  )}
                  <QuickLink to={links.settings} icon={Settings}>
                    Settings
                  </QuickLink>
                </nav>
              </CardBody>
            </Card>
          </aside>

          {/* ================= Main content ================= */}
          <div className="min-w-0 space-y-6">
            <Card>
              <CardHeader
                title="Profile photo"
                description="This is how you appear across Prodexa."
              />
              <CardBody className="space-y-3">
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
                  loadingLabel="Uploading..."
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
                    <Button variant="ghost" disabled={avatarUploading} onClick={() => setAvatarFile(null)}>
                      Cancel
                    </Button>
                  </div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Account details"
                description="Your personal information and permissions."
                action={
                  <Button
                    size="sm"
                    variant="secondary"
                    leftIcon={<Pencil className="size-4" aria-hidden="true" />}
                    onClick={() => setEditOpen(true)}
                  >
                    Edit
                  </Button>
                }
              />
              <CardBody className="grid gap-3 sm:grid-cols-2">
                <DetailTile
                  icon={<UserRound className="size-5" />}
                  label="Full name"
                  value={user.name}
                  className="sm:col-span-2"
                />
                <DetailTile icon={<Mail className="size-5" />} label="Email address" value={user.email} />
                <DetailTile
                  icon={<ShieldCheck className="size-5" />}
                  label="Account role"
                  value={ROLE_LABELS[user.role]}
                  hint="Managed by an administrator"
                />
                <DetailTile
                  icon={<CalendarDays className="size-5" />}
                  label="Member since"
                  value={since ?? "—"}
                  hint={since ? undefined : "Sign in again to load it"}
                />
                <DetailTile icon={<CircleCheck className="size-5" />} label="Account status" value="Active" />
              </CardBody>
            </Card>

            {isCustomer && (
              <Card>
                <CardHeader
                  title="Order history"
                  description="Your five most recent orders."
                  action={
                    <Link to={links.orders} className="inline-flex">
                      <Button size="sm" variant="secondary">
                        View all
                      </Button>
                    </Link>
                  }
                />
                <CardBody>
                  {ordersQuery.isPending ? (
                    <ul className="space-y-3" aria-hidden="true">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <li key={i} className="h-14 animate-pulse rounded-control border border-line bg-surface-alt" />
                      ))}
                    </ul>
                  ) : ordersQuery.isError ? (
                    <div className="rounded-control border border-dashed border-danger-600/30 bg-danger-50 px-4 py-8 text-center text-sm text-danger-700">
                      Couldn't load your orders. Please try again later.
                    </div>
                  ) : orders.length === 0 ? (
                    <div className="rounded-control border border-dashed border-line bg-surface-alt px-4 py-10 text-center text-sm text-muted">
                      No orders found.
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {orders.map((order) => (
                        <li
                          key={String(order.id)}
                          className="rounded-control border border-line bg-surface-alt px-4 py-3 transition hover:border-primary-300"
                        >
                          <Link
                            to={orderPath(order.id, links.orders)}
                            className="flex flex-wrap items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <p className="font-mono text-sm font-bold text-ink">
                                {formatNumber(order.orderNumber)}
                              </p>
                              <p className="text-xs text-muted">{formatDate(order.createdAt)}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-semibold text-ink">
                                {formatMoney(order.totalAmount)}
                              </span>
                              <OrderStatusBadge status={order.status} />
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardBody>
              </Card>
            )}

            {/* Destructive zone — kept visually apart, guarded by a confirm dialog. */}
            <Card className="border-danger-600/20 bg-danger-50/40">
              <CardBody className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-danger-700">Delete account</p>
                  <p className="text-xs text-danger-700/80">
                    Permanently remove your account. This can't be undone.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  leftIcon={<Trash2 className="size-4" aria-hidden="true" />}
                  onClick={() => setDeleteOpen(true)}
                >
                  Delete
                </Button>
              </CardBody>
            </Card>
          </div>
        </div>
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