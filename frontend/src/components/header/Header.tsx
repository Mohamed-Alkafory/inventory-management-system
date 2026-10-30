import { useState } from "react";
import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FaBars, FaSignOutAlt, FaTimes, FaUser } from "react-icons/fa";
import { Heart, Settings as SettingsIcon, ShoppingCart } from "lucide-react";
import { useAuth } from "../../context/auth/useAuth";
import { useCart } from "../../context/cart/useCart";
import { useFavorites } from "../../context/favorites/useFavorites";
import { AREA_HOME, areaForPath, homePathForRole } from "../../routes/redirect";
import NotificationBell from "../../features/notifications/NotificationBell";
import ProdexaLogo from "../Logo";
import UserAvatar from "../user/UserAvatar";
import "./header.css";

/** Icon + orange count badge; guests are sent to sign in first. */
function IconLink({
  to,
  label,
  count,
  children,
}: {
  to: string;
  label: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <Link to={to} className="icon-link" aria-label={label}>
      {children}
      {count > 0 && (
        <span className="icon-badge" aria-hidden="true">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

/**
 * Single-row store header (like a shop, not a dashboard), all on one bar:
 *  brand · nav links · search shortcut · favorites/cart · account.
 * Collapses to a burger drawer on small screens. The signed-in name is
 * intentionally NOT shown here; it lives on /profile.
 */
export default function Header() {
  const [open, setOpen] = useState(false);
  const { isAuthenticated, user, logout, role } = useAuth();
  const { totalItems } = useCart();
  const { items: favorites } = useFavorites();
  const isCustomer = role === "CUSTOMER";
  const showShopIcons = !isAuthenticated || isCustomer;
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Stay inside the dashboard the user is browsing: inside an area, links point
  // at that area (Products → /admin/products, Dashboard → /admin) instead of
  // dropping them back on the storefront.
  const area = areaForPath(pathname);

  // Products always opens inside a dashboard for signed-in users: the current
  // area when they are in one, otherwise their role's dashboard. Only guests
  // get the public storefront catalogue.
  const productsHref = area
    ? `${AREA_HOME[area]}/products`
    : isAuthenticated
      ? `${homePathForRole(role)}/products`
      : "/products";

  // Dashboard shortcut: the current area when inside one, else the role's home.
  const dashboardHref = area ? AREA_HOME[area] : isAuthenticated ? homePathForRole(role) : null;

  const settingsHref = area ? `${AREA_HOME[area]}/settings` : "/settings";
  const profileHref = area ? `${AREA_HOME[area]}/profile` : "/profile";
  const notificationsHref = area ? `${AREA_HOME[area]}/notifications` : "/notifications";
  const cartHref = isAuthenticated ? (area === "customer" ? "/dashboard/cart" : "/cart") : "/login";
  const favoritesHref = isAuthenticated
    ? area === "customer"
      ? "/dashboard/favorites"
      : "/favorites"
    : "/login";

  const navLinks = [
    { label: "Home", href: "/" },
    ...(dashboardHref ? [{ label: "Dashboard", href: dashboardHref }] : []),
    { label: "Products", href: productsHref },
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
  ];

  const closeMenu = () => setOpen(false);

  const handleLogout = async () => {
    closeMenu();
    await logout();
    navigate("/", { replace: true });
  };

  const links = (
    <ul className="nav-list" id="main-nav-list">
      {navLinks.map((link) => (
        <li key={link.label}>
          <Link to={link.href} className="nav-link" onClick={closeMenu}>
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <header className="header">
      <div className="header__inner">
        <div className="header__row">
          {/* Brand (left) */}
          <div className="header__left">
            <a href="/" className="header__logo" aria-label="Prodexa home">
              <ProdexaLogo size={36} showWordmark={false} />
              <span className="header__wordmark">
                PRODEX<span>A</span>
              </span>
            </a>
          </div>

          {/* Desktop nav links (centered) */}
          <div className="header__links">
            {navLinks.map((link) => (
              <Link key={link.label} to={link.href}>
                {link.label}
              </Link>
            ))}
          </div>

          {/* Icons + account (right) */}
          <div className="header__right">
            <div className="header__icons">
              {isAuthenticated && <NotificationBell viewAllPath={notificationsHref} />}
              {showShopIcons && (
                <>
                  <IconLink
                    to={favoritesHref}
                    label="Favorites"
                    count={isAuthenticated ? favorites.length : 0}
                  >
                    <Heart className="size-5" aria-hidden="true" />
                  </IconLink>
                  <IconLink
                    to={cartHref}
                    label="Cart"
                    count={isAuthenticated ? totalItems : 0}
                  >
                    <ShoppingCart className="size-5" aria-hidden="true" />
                  </IconLink>
                </>
              )}
            </div>

            <div className="header__acct">
              {isAuthenticated ? (
                <>
                  <button type="button" className="btn--plain" onClick={handleLogout}>
                    <FaSignOutAlt aria-hidden="true" />
                    Log out
                  </button>
                  <Link to={settingsHref} className="icon-btn" aria-label="Settings">
                    <SettingsIcon className="size-5" aria-hidden="true" />
                  </Link>
                  <Link to={profileHref} className="icon-btn" aria-label="Your profile">
                    <UserAvatar name={user?.name} src={user?.avatarUrl} size="sm" />
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/login" className="btn--plain">
                    Log in
                  </Link>
                  <Link to="/register" className="btn btn--primary">
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Mobile drawer */}
          <nav id="main-nav" className={`header__nav ${open ? "is-open" : ""}`} aria-label="Main">
            {links}

            {/* Drawer-only actions */}
            <div className="header__actions">
              {isAuthenticated ? (
                <>
                  <button type="button" className="btn btn--ghost" onClick={handleLogout}>
                    <FaSignOutAlt aria-hidden="true" style={{ marginRight: 8 }} />
                    Log out
                  </button>
                  <Link to={settingsHref} className="btn btn--ghost" onClick={closeMenu}>
                    <SettingsIcon className="size-4" aria-hidden="true" style={{ marginRight: 8 }} />
                    Settings
                  </Link>
                  <Link to={profileHref} className="btn btn--primary" onClick={closeMenu}>
                    <FaUser aria-hidden="true" style={{ marginRight: 8 }} />
                    My profile
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/login" className="btn btn--ghost" onClick={closeMenu}>
                    Log in
                  </Link>
                  <Link to="/register" className="btn btn--primary" onClick={closeMenu}>
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </nav>

          <button
            type="button"
            className="header__toggle"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="main-nav"
            onClick={() => setOpen((prev) => !prev)}
          >
            {open ? <FaTimes /> : <FaBars />}
          </button>
        </div>
      </div>
    </header>
  );
}