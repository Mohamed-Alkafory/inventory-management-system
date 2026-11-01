import { Link } from "react-router-dom";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import Reveal from "../../../components/motion/Reveal";
import Shine from "../../../components/motion/Shine";
import { buttonClass } from "../../../components/ui/buttonClass";
import { spotlightHandler } from "../../../hooks/useSpotlight";
import { BRAND } from "../../../lib/brand";
import { ASSURANCES, HERO_TAGS } from "../data/content";
import DashboardPreview from "./DashboardPreview";

export default function HomeHero() {
  return (
    <section
      onPointerMove={spotlightHandler}
      className="relative isolate w-full overflow-hidden bg-linear-to-b from-[#FCF7F2] to-[#FDFDFC] px-4 pb-14 pt-12 sm:px-6 sm:pt-16 lg:px-10 lg:pb-20"
    >
      {/* Animated backdrop: drifting blobs + a glow that follows the cursor */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 top-8 h-72 w-72 animate-blob rounded-full bg-primary-200/50 blur-3xl motion-reduce:animate-none" />
        <div
          className="absolute -right-10 top-1/3 h-80 w-80 animate-blob rounded-full bg-[#FDBA8C]/40 blur-3xl motion-reduce:animate-none"
          style={{ animationDelay: "-7s" }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(480px_circle_at_var(--mx,70%)_var(--my,30%),rgba(255,107,0,0.10),transparent_60%)]" />
      </div>

      <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-2">
        <div className="text-center lg:text-left">
          <Reveal>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FDECDC] bg-[#FDF6F0] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#E0600A]">
              <Sparkles className="h-3.5 w-3.5 animate-pulse motion-reduce:animate-none" aria-hidden="true" />
              Inventory &amp; Order Management
            </span>
          </Reveal>

          <Reveal delay={100}>
            <h1 className="mt-5 text-4xl font-bold leading-tight text-ink sm:text-5xl lg:text-6xl">
              Know exactly{" "}
              <span className="relative text-primary-600">
                what you have
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 -bottom-1 h-1.5 origin-left animate-underline rounded-full bg-primary-300/70 motion-reduce:animate-none"
                />
              </span>
              , everywhere you sell.
            </h1>
          </Reveal>

          <Reveal delay={200}>
            <p className="mx-auto mt-5 max-w-xl leading-relaxed text-muted lg:mx-0">
              {BRAND} brings products, stock levels, orders and suppliers into one calm dashboard, so you spend less
              time counting and more time growing.
            </p>
          </Reveal>

          <Reveal delay={300}>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Link
                to="/contact"
                className={buttonClass(
                  "primary",
                  "lg",
                  "group relative w-full overflow-hidden shadow-md shadow-primary-500/30 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary-500/40 sm:w-auto",
                  true,
                )}
              >
                <Shine />
                Request a Demo
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none"
                  aria-hidden="true"
                />
              </Link>
              <a
                href="#how-it-works"
                className={buttonClass("secondary", "lg", "w-full hover:-translate-y-0.5 sm:w-auto", true)}
              >
                See How It Works
              </a>
              <Link
                to="/products"
                className={buttonClass("secondary", "lg", "w-full hover:-translate-y-0.5 sm:w-auto", true)}
              >
                Browse Products
              </Link>
            </div>
          </Reveal>

          <Reveal delay={400}>
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
          </Reveal>

          <Reveal delay={500}>
            <ul className="mt-8 flex flex-wrap justify-center gap-2 lg:justify-start">
              {HERO_TAGS.map((t) => (
                <li
                  key={t.label}
                  className="flex items-center gap-2 rounded-full border border-[#E6E9EE] bg-white px-3 py-1.5 text-xs font-medium text-[#46566B] shadow-sm transition hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                    <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 motion-reduce:animate-none ${t.dot}`} />
                    <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${t.dot}`} />
                  </span>
                  {t.label}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <Reveal direction="left" delay={250} className="mx-auto w-full max-w-xl pb-6 lg:max-w-none">
          <DashboardPreview />
        </Reveal>
      </div>
    </section>
  );
}
