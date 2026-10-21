import { useState } from "react";
import { FaBars, FaTimes, FaUser } from "react-icons/fa";
import ProdexaLogo from "../Logo";
import "./Header.css";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Products", href: "#products" },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
];

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="header">
      <div className="header__inner">
        <a href="/" className="header__logo" aria-label="Prodexa home">
          <ProdexaLogo />
        </a>

        <nav
          id="main-nav"
          className={`header__nav ${open ? "is-open" : ""}`}
          aria-label="Main"
        >
          <ul className="nav-list">
            {NAV_LINKS.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  className="nav-link"
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          {/* Shown inside the mobile menu only */}
          <div className="header__actions header__actions--mobile">
            <a href="#" className="btn btn--ghost">
              Sign in
            </a>
            <a href="#" className="btn btn--primary">
              Get started free
            </a>
          </div>
        </nav>

        <div className="header__actions header__actions--desktop">
          <a href="#" className="btn btn--ghost">
            Sign in
          </a>
          <a href="#" className="btn btn--primary">
            Get started free
          </a>
          <a href="#" className="avatar" aria-label="Your profile">
            <FaUser />
          </a>
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
