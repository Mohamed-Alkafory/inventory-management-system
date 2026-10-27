import { Link, useNavigate } from "react-router-dom";
import { FaSignOutAlt, FaUser } from "react-icons/fa";
import { ArrowRight, Boxes, Heart, LayoutDashboard, ShoppingCart } from "lucide-react";
import { Button, Card, CardBody } from "../../components/ui";
import { useAuth } from "../../context/auth/useAuth";
import { useCart } from "../../context/cart/useCart";
import { useFavorites } from "../../context/favorites/useFavorites";

/**
 * The only place the signed-in name is shown — the header deliberately
 * keeps it out. Small account hub: identity, quick links, log out.
 */
export default function Profile() {
  const { user, hasRole, logout } = useAuth();
  const isAdmin = hasRole("ADMIN");
  const { totalItems } = useCart();
  const { items: favorites } = useFavorites();
  const navigate = useNavigate();

  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-[calc(100vh-128px)] bg-surface-alt py-10 text-ink">
      <div className="mx-auto w-full max-w-xl px-4 sm:px-6">
        <h1 className="text-3xl font-bold">My Profile</h1>

        <Card className="mt-6">
          <CardBody className="flex flex-col items-center gap-4 p-6 text-center">
            <span className="flex size-20 items-center justify-center rounded-full bg-[#fff3ea] text-3xl text-[#e6620b]" aria-hidden="true">
              <FaUser />
            </span>
            <div>
              <p className="text-xl font-bold text-ink">{user.name}</p>
              <p className="mt-0.5 text-sm text-muted">{user.email}</p>
            </div>
            <span className="rounded-full bg-surface-alt px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted">
              {user.role}
            </span>

            <div className="mt-2 grid w-full grid-cols-2 gap-3">
              <Link
                to="/favorites"
                className="group flex items-center justify-center gap-2 rounded-control border border-line bg-surface px-4 py-3 text-sm font-semibold text-ink transition hover:border-primary-500 hover:text-primary-600 focus-visible:outline-2 focus-visible:outline-primary-500"
              >
                <Heart className="size-4" aria-hidden="true" />
                Favorites
                <span className="font-mono text-xs text-muted group-hover:text-primary-600">({favorites.length})</span>
              </Link>
              <Link
                to="/cart"
                className="group flex items-center justify-center gap-2 rounded-control border border-line bg-surface px-4 py-3 text-sm font-semibold text-ink transition hover:border-primary-500 hover:text-primary-600 focus-visible:outline-2 focus-visible:outline-primary-500"
              >
                <ShoppingCart className="size-4" aria-hidden="true" />
                Cart
                <span className="font-mono text-xs text-muted group-hover:text-primary-600">({totalItems})</span>
              </Link>
            </div>

            <div className="flex w-full flex-col gap-3 pt-2 sm:flex-row">
              {isAdmin ? (
                <Link to="/admin" className="flex-1">
                  <Button fullWidth leftIcon={<Boxes className="size-4" aria-hidden="true" />}>
                    Admin panel
                  </Button>
                </Link>
              ) : (
                <Link to="/dashboard" className="flex-1">
                  <Button fullWidth leftIcon={<LayoutDashboard className="size-4" aria-hidden="true" />}>
                    Dashboard
                  </Button>
                </Link>
              )}
              <Button
                variant="secondary"
                className="flex-1"
                leftIcon={<FaSignOutAlt aria-hidden="true" />}
                onClick={() => void handleLogout()}
              >
                Log out
              </Button>
            </div>

            {isAdmin ? null : (
              <p className="flex items-center gap-1 pt-1 text-xs text-muted">
                <ArrowRight className="size-3" aria-hidden="true" />
                Staff members manage stock from the dashboard.
              </p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
