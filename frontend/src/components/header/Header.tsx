import { useState } from "react";
import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FaBars, FaSignOutAlt, FaTimes, FaUser } from "react-icons/fa";
import { Heart, ShoppingCart } from "lucide-react";
import { useAuth } from "../../context/auth/useAuth";
import { useCart } from "../../context/cart/useCart";
import { useFavorites } from "../../context/favorites/useFavorites";
import { useAreaLinks } from "../../routes/useAreaLinks";
import NotificationBell from "../../features/notifications/NotificationBell";
import ProdexaLogo from "../Logo";
import UserAvatar from "../user/UserAvatar";
import "./header.css";

/** Screens that render their own full-page shell without the global header. */
const AUTH_PATHS = new Set(["/login", "/register"]);

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

  // Auth-aware links: signed-in users stay inside the dashboard area they are
  // browsing (or their role's home); guests get the public storefront.
  const areaLinks = useAreaLinks();

  // Auth screens are a focused, full-screen experience — no site chrome.
  if (AUTH_PATHS.has(pathname)) return null;

  const productsHref = areaLinks.products;
  const dashboardHref = areaLinks.dashboard;
  const profileHref = areaLinks.profile;
  const notificationsHref = areaLinks.notifications;
  const cartHref = isAuthenticated ? areaLinks.cart : "/login";
  const favoritesHref = isAuthenticated ? areaLinks.favorites : "/login";

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