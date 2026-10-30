import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaBars, FaSignOutAlt, FaTimes, FaUser } from "react-icons/fa";
import { ChevronDown, Heart, LayoutGrid, Search, ShoppingCart } from "lucide-react";
import { useAuth } from "../../context/auth/useAuth";
import { useCart } from "../../context/cart/useCart";
import { useFavorites } from "../../context/favorites/useFavorites";
import { useCatalogCategories } from "../../hooks/useCatalog";
import { homePathForRole } from "../../routes/redirect";
import NotificationBell from "../../features/notifications/NotificationBell";
import ProdexaLogo from "../Logo";
import UserAvatar from "../user/UserAvatar";
import "./header.css";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Products", href: "/products" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

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
 * Two-row store header (like a shop, not a dashboard):
 *  row 1 — brand, product search, favorites/cart icons;
 *  row 2 — browse-categories dropdown, nav links, log out + profile.
 * The signed-in name is intentionally NOT shown here; it lives on /profile.
 */
export default function Header() {
  const [open, setOpen] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const { isAuthenticated, user, logout, role } = useAuth();
  const { totalItems } = useCart();
  const { items: favorites } = useFavorites();
  const isCustomer = role === "CUSTOMER";
  const showShopIcons = !isAuthenticated || isCustomer;
  // Public catalog categories: safe for guests, customers and staff alike (no token).
  const categories = useCatalogCategories();
  const navigate = useNavigate();
  const catsRef = useRef<HTMLDivElement>(null);

  // Signed-in staff/admin get a shortcut to their area; customers get their orders.
  const areaLink = role && !isCustomer ? { label: "Dashboard", href: homePathForRole(role) } : null;
  const ordersLink = isCustomer ? { label: "My orders", href: "/orders" } : null;
  const notificationsLink = isAuthenticated ? { label: "Notifications", href: "/notifications" } : null;
  const extraLinks = [areaLink, ordersLink, notificationsLink].filter(
    (link): link is { label: string; href: string } => link !== null,
  );
  const navLinks = extraLinks.length > 0
    ? [NAV_LINKS[0], ...extraLinks, ...NAV_LINKS.slice(1)]
    : NAV_LINKS;

  const closeMenu = () => setOpen(false);

  // Close the category dropdown on outside click or Escape.
  useEffect(() => {
    if (!catsOpen) return;
    const onDown = (event: MouseEvent) => {
      if (!catsRef.current?.contains(event.target as Node)) setCatsOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCatsOpen(false);
      if (event.key === "Tab" && !catsRef.current?.contains(event.target as Node)) setCatsOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [catsOpen]);

  /** Header search deep-links straight into the catalogue with its URL filters. */
  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    closeMenu();
    const q = searchText.trim();
    navigate(q ? `/products?q=${encodeURIComponent(q)}` : "/products");
  };

  const handleLogout = async () => {
    closeMenu();
    await logout();
    navigate("/", { replace: true });
  };

  const goToCategory = (id: string) => {
    setCatsOpen(false);
    closeMenu();
    navigate(`/products?category=${encodeURIComponent(id)}`);
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
        {/* Row 1 — brand, search, shop icons */}
        <div className="header__top">
          <a href="/" className="header__logo" aria-label="Prodexa home">
            <ProdexaLogo size={38} showWordmark={false} />
            <span className="header__wordmark">
              PRODEX<span>A</span>
            </span>
          </a>

          <form className="header__search" role="search" onSubmit={handleSearch}>
            <input
              type="search"
              placeholder="Search for products"
              aria-label="Search for products"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
            <button type="submit" aria-label="Search">
              <Search className="size-5" aria-hidden="true" />
            </button>
          </form>

          <div className="header__icons">
            {isAuthenticated && <NotificationBell />}
            {showShopIcons && (
              <>
                <IconLink
                  to={isAuthenticated ? "/favorites" : "/login"}
                  label="Favorites"
                  count={isAuthenticated ? favorites.length : 0}
                >
                  <Heart className={favorites.length > 0 ? "size-5 fill-current" : "size-5"} aria-hidden="true" />
                </IconLink>
                <IconLink
                  to={isAuthenticated ? "/cart" : "/login"}
                  label="Cart"
                  count={isAuthenticated ? totalItems : 0}
                >
                  <ShoppingCart className="size-5" aria-hidden="true" />
                </IconLink>
              </>
            )}
          </div>

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
                  <Link to="/profile" className="btn btn--primary" onClick={closeMenu}>
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

        {/* Row 2 — categories, links, account */}
        <div className="header__main">
          <div className="header__main-inner">
            <div className="header__cats" ref={catsRef}>
              <button
                type="button"
                className="header__cats-btn"
                aria-expanded={catsOpen}
                aria-controls="header-cats-menu"
                onClick={() => setCatsOpen((prev) => !prev)}
              >
                <LayoutGrid className="size-4" aria-hidden="true" />
                Browse Category
                <ChevronDown className="chevron size-4" aria-hidden="true" />
              </button>
              {catsOpen && (
                <div className="header__cats-menu" id="header-cats-menu" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    className="header__cats-item"
                    onClick={() => {
                      setCatsOpen(false);
                      closeMenu();
                      navigate("/products");
                    }}
                  >
                    Browse all products
                  </button>
                  {categories.isPending && (
                    <span className="header__cats-item" aria-disabled="true">
                      Loading categories…
                    </span>
                  )}
                  {categories.isError && (
                    <button type="button" className="header__cats-item" onClick={() => void categories.refetch()}>
                      Couldn't load categories — retry
                    </button>
                  )}
                  {categories.data?.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      role="menuitem"
                      className="header__cats-item"
                      onClick={() => goToCategory(c.id)}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="header__links">
              {navLinks.map((link) => (
                <Link key={link.label} to={link.href}>
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="header__acct">
              {isAuthenticated ? (
                <>
                  <button type="button" className="btn--plain" onClick={handleLogout}>
                    <FaSignOutAlt aria-hidden="true" />
                    Log out
                  </button>
                  <Link to="/profile" className="icon-btn" aria-label="Your profile">
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
        </div>
      </div>
    </header>
  );
}
