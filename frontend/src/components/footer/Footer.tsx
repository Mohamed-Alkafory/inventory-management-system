import { Link } from "react-router-dom";
import { FaFacebookF, FaInstagram, FaXTwitter, FaYoutube } from "react-icons/fa6";
import { FaEnvelope, FaMapMarkerAlt, FaPhone } from "react-icons/fa";
import Container from "../ui/Container";
import ProdexaLogo from "../Logo";

const SHOP_LINKS = [
  { label: "Products", href: "/products" },
  { label: "Categories", href: "/products" },
  { label: "Stores", href: "#" },
  { label: "Sellers", href: "#" },
  { label: "New arrivals", href: "#" },
];

const SERVICE_LINKS = [
  { label: "My Cart", href: "#" },
  { label: "Favorites", href: "#" },
  { label: "About Us", href: "/about" },
  { label: "Contact", href: "/contact" },
];

const CONTACT_ROWS = [
  { icon: FaEnvelope, text: "support@prodexa.com", href: "mailto:support@prodexa.com" },
  { icon: FaPhone, text: "+1 (555) 123-4567", href: "tel:+15551234567" },
  { icon: FaMapMarkerAlt, text: "123 Market Street", href: "#" },
];

const SOCIALS = [
  { icon: FaFacebookF, label: "Facebook", href: "#" },
  { icon: FaInstagram, label: "Instagram", href: "#" },
  { icon: FaXTwitter, label: "X", href: "#" },
  { icon: FaYoutube, label: "YouTube", href: "#" },
];

const FOOTER_HEADING =
  "mb-4 text-xs font-bold uppercase tracking-[0.18em] text-blue-200";

const FOOTER_LINK =
  "text-sm text-blue-100/90 transition hover:text-white focus-visible:outline-2 focus-visible:outline-blue-300";

/**
 * Site-wide footer: brand block with masthead + tagline + socials on the
 * left, link columns and contact details on the right.
 */
export default function Footer() {
  return (
    <footer id="contact" className="scroll-mt-20 bg-[#FF6B35] text-white">
      <Container className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        {/* Brand */}
        <div>
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-white">
              <ProdexaLogo size={34} showWordmark={false} />
            </span>
            <p className="text-2xl font-bold tracking-[0.08em] text-white">
              PRODEXA
            </p>
          </div>

          <p className="mt-5 max-w-64 text-sm leading-relaxed text-white">
            Quality electronics and accessories, delivered with care.
          </p>

          <div className="mt-6 flex gap-3">
            {SOCIALS.map(({ icon: Icon, label, href }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                className="flex size-9 items-center justify-center rounded-lg border border-white text-white transition hover:border-blue-200 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-blue-300"
              >
                <Icon className="size-4" aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>

        {/* Shop */}
        <nav aria-label="Shop">
          <h4 className={FOOTER_HEADING}>Shop</h4>
          <ul className="space-y-3">
            {SHOP_LINKS.map((l) => (
              <li key={l.label}>
                {l.href.startsWith("/") ? (
                  <Link to={l.href} className={FOOTER_LINK}>
                    {l.label}
                  </Link>
                ) : (
                  <a href={l.href} className={FOOTER_LINK}>
                    {l.label}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </nav>

        {/* Customer service */}
        <nav aria-label="Customer service">
          <h4 className={FOOTER_HEADING}>Customer Service</h4>
          <ul className="space-y-3">
            {SERVICE_LINKS.map((l) => (
              <li key={l.label}>
                {l.href.startsWith("/") ? (
                  <Link to={l.href} className={FOOTER_LINK}>
                    {l.label}
                  </Link>
                ) : (
                  <a href={l.href} className={FOOTER_LINK}>
                    {l.label}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </nav>

        {/* Contact */}
        <div>
          <h4 className={FOOTER_HEADING}>Contact</h4>
          <ul className="space-y-3">
            {CONTACT_ROWS.map(({ icon: Icon, text, href }) => (
              <li key={text}>
                <a href={href} className={`inline-flex items-center gap-2.5 ${FOOTER_LINK}`}>
                  <Icon className="size-4 shrink-0 text-white" aria-hidden="true" />
                  {text}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </Container>

      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="border-t border-white/20 py-5 text-sm text-blue-100/60">
          © {new Date().getFullYear()} Prodexa. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
