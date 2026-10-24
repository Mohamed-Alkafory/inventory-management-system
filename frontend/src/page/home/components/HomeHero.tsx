import { Link } from "react-router-dom";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { buttonClass } from "../../../components/ui/buttonClass";
import { BRAND } from "../../../lib/brand";
import { ASSURANCES, HERO_TAGS } from "../data/content";
import DashboardPreview from "./DashboardPreview";

export default function HomeHero() {
  return (
    <section className="w-full bg-linear-to-b from-[#FCF7F2] to-[#FDFDFC] px-4 pb-14 pt-12 sm:px-6 sm:pt-16 lg:px-10 lg:pb-20">
      <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-2">
        <div className="text-center lg:text-left">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FDECDC] bg-[#FDF6F0] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#E0600A]">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Inventory &amp; Order Management
          </span>

          <h1 className="mt-5 text-4xl font-bold leading-tight text-ink sm:text-5xl lg:text-6xl">
            Know exactly what you have, everywhere you sell.
          </h1>

          <p className="mx-auto mt-5 max-w-xl leading-relaxed text-muted lg:mx-0">
            {BRAND} brings products, stock levels, orders and suppliers into one calm dashboard, so you spend less
            time counting and more time growing.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <Link
              to="/contact"
              className={buttonClass("primary", "lg", "w-full shadow-md shadow-primary-500/30 sm:w-auto", true)}
            >
              Start 14-Day Free Trial
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <a
              href="#how-it-works"
              className={buttonClass("secondary", "lg", "w-full sm:w-auto", true)}
            >
              See How It Works
            </a>
          </div>

          <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium text-ink lg:justify-start">
            {ASSURANCES.map((a) => (
              <li key={a} className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ink text-white">
                  <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                </span>
                {a}
              </li>
            ))}
          </ul>

          <ul className="mt-8 flex flex-wrap justify-center gap-2 lg:justify-start">
            {HERO_TAGS.map((t) => (
              <li
                key={t.label}
                className="flex items-center gap-2 rounded-full border border-[#E6E9EE] bg-white px-3 py-1.5 text-xs font-medium text-[#46566B] shadow-sm"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} aria-hidden="true" />
                {t.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="mx-auto w-full max-w-xl pb-6 lg:max-w-none">
          <DashboardPreview />
        </div>
      </div>
    </section>
  );
}
