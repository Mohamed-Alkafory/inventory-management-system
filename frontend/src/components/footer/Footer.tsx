import { Link } from "react-router-dom";
import { Mail, MapPin, Phone } from "lucide-react";
import { FaFacebookF, FaInstagram, FaXTwitter, FaYoutube } from "react-icons/fa6";
import { useAreaLinks } from "../../routes/useAreaLinks";
import ProdexaLogo from "../Logo";
import { BRAND } from "../../lib/brand";

const CONTACT_ROWS = [
  { icon: Mail, text: "support@prodexa.com", href: "mailto:support@prodexa.com" },
  { icon: Phone, text: "+1 (555) 123-4567", href: "tel:+15551234567" },
];

const SOCIALS = [
  { icon: FaFacebookF, label: "Facebook", href: "#" },
  { icon: FaInstagram, label: "Instagram", href: "#" },
  { icon: FaXTwitter, label: "X", href: "#" },
  { icon: FaYoutube, label: "YouTube", href: "#" },
];

const FOOTER_HEADING = "text-xs font-bold uppercase tracking-[0.18em] text-ink";
const FOOTER_LINK =
  "text-sm text-muted transition-colors hover:text-primary-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500";

/**
 * Storefront footer. Sits on the same 1650px rail as the header so the brand,
 * columns and bottom row line up with the logo and nav above. Light surfaces
 * and orange accents keep it in the app's palette. Rendered only on public
 * pages (see SiteFooter).
 */
export default function Footer() {
  const year = new Date().getFullYear();
  const links = useAreaLinks();

  const shopLinks = [
    { label: "Home", to: "/" },
    { label: "Products", to: links.products },
    { label: "About us", to: "/about" },
    { label: "Contact", to: "/contact" },
  ];

  // Favorites and cart belong to the customer storefront; other signed-in
  // roles don't have those pages in their dashboards.
  const showStorefrontLinks = !links.isAuthenticated || links.role === "CUSTOMER";

  const accountLinks = [
    { label: "My profile", to: links.profile },
    { label: "My orders", to: links.orders },
    ...(showStorefrontLinks
      ? [
          { label: "Favorites", to: links.favorites },
          { label: "Cart", to: links.cart },
        ]
      : []),
    { label: "Settings", to: links.settings },
  ];

  return (
    <footer className="bg-linear-to-b from-surface-alt to-[#E9EDF2] text-ink">
      {/* Same horizontal rail as the header: max-w-1650 + 24px outer, 40px inner. */}
      <div className="mx-auto w-full max-w-[1650px] px-6">
        <div className="grid gap-12 px-4 py-14 sm:px-10 lg:grid-cols-[1.6fr_1fr_1fr_1.2fr]">
          {/* Brand */}
          <div className="max-w-sm">
            <Link
              to="/"
              className="inline-flex items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-500"
            >
              <span className="flex size-11 items-center justify-center rounded-xl border border-line bg-white shadow-sm">
                <ProdexaLogo size={34} showWordmark={false} />
              </span>
              <span className="text-2xl font-extrabold tracking-[0.08em] text-ink">
                PRODEX<span className="text-primary-600">A</span>
              </span>
            </Link>

            <p className="mt-5 max-w-64 text-sm leading-relaxed text-muted">
              Quality electronics and accessories, delivered with care — with the inventory insight to keep every shelf
              stocked.
            </p>

            <div className="mt-6 flex gap-3">
              {SOCIALS.map(({ icon: Icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="flex size-9 items-center justify-center rounded-lg border border-line bg-white text-muted transition hover:-translate-y-0.5 hover:border-primary-500 hover:bg-primary-50 hover:text-primary-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
                >
                  <Icon className="size-4" aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>

          {/* Shop */}
          <nav aria-label="Shop" className="min-w-0">
            <h2 className={FOOTER_HEADING}>Shop</h2>
            <ul className="mt-4 space-y-3">
              {shopLinks.map((link) => (
                <li key={link.label}>
                  <Link to={link.to} className={FOOTER_LINK}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Account */}
          <nav aria-label="Account" className="min-w-0">
            <h2 className={FOOTER_HEADING}>Account</h2>
            <ul className="mt-4 space-y-3">
              {accountLinks.map((link) => (
                <li key={link.label}>
                  <Link to={link.to} className={FOOTER_LINK}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Contact */}
          <div className="min-w-0">
            <h2 className={FOOTER_HEADING}>Contact</h2>
            <ul className="mt-4 space-y-3">
              {CONTACT_ROWS.map(({ icon: Icon, text, href }) => (
                <li key={text}>
                  <a href={href} className={`${FOOTER_LINK} inline-flex items-center gap-2.5`}>
                    <Icon className="size-4 shrink-0 text-primary-600" aria-hidden="true" />
                    {text}
                  </a>
                </li>
              ))}
              <li className="flex items-center gap-2.5 text-sm text-muted">
                <MapPin className="size-4 shrink-0 text-primary-600" aria-hidden="true" />
                123 Market Street
              </li>
            </ul>

            <p className="mt-5 text-xs leading-relaxed text-muted">
              Real-time stock levels, orders and suppliers — all in one place.
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-line/70">
        <div className="mx-auto flex w-full max-w-[1650px] flex-col items-center justify-between gap-2 px-6 py-5 text-sm text-muted sm:flex-row">
          <p>
            © {year} {BRAND}. All rights reserved.
          </p>
          <p>Inventory &amp; order management, simplified.</p>
        </div>
      </div>
    </footer>
  );
}
