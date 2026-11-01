import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { BRAND } from "../../lib/brand";
import ProdexaLogo from "../Logo";

type AuthLayoutProps = {
  /** Page heading, e.g. "Welcome back". */
  title: string;
  /** One line of supporting text under the heading. */
  subtitle: string;
  children: ReactNode;
  /** Rendered under the card, e.g. "New to Prodexa? Create an account". */
  footer?: ReactNode;
  /** Use a slightly wider card (the sign-up form is longer). */
  wide?: boolean;
};

/**
 * Shared shell for the sign-in and sign-up screens: a single centred card on a
 * soft brand-tinted background. Keeps both auth pages visually identical.
 */
export default function AuthLayout({ title, subtitle, children, footer, wide = false }: AuthLayoutProps) {
  const year = new Date().getFullYear();

  return (
    <div className="relative min-h-screen overflow-hidden bg-surface-alt text-ink">
      {/* Decorative background: brand wash, soft blobs and a faint grid. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-surface-alt to-primary-100/50" />
        <div className="absolute -left-24 -top-28 h-72 w-72 rounded-full bg-primary-200/50 blur-3xl" />
        <div className="absolute -right-24 top-1/4 h-64 w-64 rounded-full bg-primary-300/30 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-info-50 blur-3xl" />
        <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,rgb(16_34_58/0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgb(16_34_58/0.045)_1px,transparent_1px)] [background-size:28px_28px]" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="flex items-center px-5 py-5 sm:px-8">
          <Link to="/" className="flex items-center gap-2.5" aria-label={`${BRAND} home`}>
            <ProdexaLogo size={34} showWordmark={false} />
            <span className="text-lg font-extrabold tracking-widest text-primary-600">PRODEXA</span>
          </Link>
        </header>

        <main className="flex flex-1 items-center justify-center px-4 py-6 sm:px-6 sm:py-10">
          <div className={`w-full ${wide ? "max-w-lg" : "max-w-md"}`}>
            <div className="animate-pop-in rounded-modal border border-line bg-white/95 p-6 shadow-overlay backdrop-blur-sm sm:p-8">
              <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
                <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
              </div>

              {children}
            </div>

            {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
          </div>
        </main>

        <footer className="px-5 py-6 text-center text-xs text-muted sm:px-8">
          © {year} {BRAND}. All rights reserved.
        </footer>
      </div>
    </div>
  );
}
