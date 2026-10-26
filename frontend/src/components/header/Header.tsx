import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { FaBars, FaSignOutAlt, FaTimes, FaUser } from "react-icons/fa";
import { useAuth } from "../../context/auth/useAuth";
import ProdexaLogo from "../Logo";
import "./header.css";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Products", href: "/products" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const closeMenu = () => setOpen(false);

  const handleLogout = async () => {
    closeMenu();
    await logout();
    navigate("/", { replace: true });
  };

  // While signed in, the navbar points at the app pages; visitors get the
  // public product catalogue link, which prompts them to sign in.
  const dashboardLink = isAuthenticated ? "/dashboard" : "/login";

  return (
    <header className="header">
      <div className="header__inner">
        <a href="/" className="header__logo" aria-label="Prodexa home">
          <ProdexaLogo />
        </a>

        <nav id="main-nav" className={`header__nav ${open ? "is-open" : ""}`} aria-label="Main">
          <ul className="nav-list">
            {NAV_LINKS.map((link) => (
              <li key={link.label}>
                <Link to={link.href} className="nav-link" onClick={closeMenu}>
                  {link.label}
                </Link>
              </li>
            ))}
            {isAuthenticated && (
              <li>
                <Link to={dashboardLink} className="nav-link" onClick={closeMenu}>
                  Dashboard
                </Link>
              </li>
            )}
          </ul>

          {/* Shown inside the mobile menu only */}
          <div className="header__actions header__actions--mobile">
            {isAuthenticated ? (
              <button type="button" className="btn btn--primary" onClick={handleLogout}>
                Log out
              </button>
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

        <div className="header__actions header__actions--desktop">
          {isAuthenticated ? (
            <>
              <span className="header__user" title={user?.email}>
                {user?.name} · {user?.role}
              </span>
              <button type="button" className="btn btn--ghost" onClick={handleLogout}>
                <FaSignOutAlt aria-hidden="true" style={{ marginRight: 8 }} />
                Log out
              </button>
              <Link to="/dashboard" className="avatar" aria-label="Your dashboard">
                <FaUser />
              </Link>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn--ghost">
                Log in
              </Link>
              <Link to="/register" className="btn btn--primary">
                Sign up
              </Link>
            </>
          )}
        </div>

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
    </header>
  );
}
