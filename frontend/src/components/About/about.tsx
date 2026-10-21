import type { ReactNode } from "react";
import {
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Eye,
  Heart,
  Package,
  RotateCcw,
  Sparkles,
  Target,
  Users,
  Zap,
} from "lucide-react";

/* ---------- Data ---------- */

const BRAND = "Prodexa"; // غيّر الاسم من هنا

const tags = [
  { label: "Real-Time Architecture", dot: "bg-[#FA6F10]" },
  { label: "Multi-Channel First", dot: "bg-[#FF8A3D]" },
  { label: "Designed for SMB Operators", dot: "bg-[#FA6F10]" },
  { label: "Zero Clunky Bloatware", dot: "bg-[#FF8A3D]" },
];

const pillars = [
  {
    icon: <Target className="h-8 w-8" />,
    title: "Our Mission",
    text: "To simplify inventory and order management, reduce errors, and help businesses grow with confidence.",
    bg: "bg-[#FEF9F5] border-[#FDECDC]",
  },
  {
    icon: <Eye className="h-8 w-8" />,
    title: "Our Vision",
    text: "To become the leading inventory management platform for businesses of all sizes, worldwide.",
    bg: "bg-[#F8F8F8] border-[#EEF0F3]",
  },
  {
    icon: <Heart className="h-8 w-8" />,
    title: "Our Values",
    text: "Accuracy, simplicity and transparency in every feature we build and every count we make.",
    bg: "bg-[#FEF9F5] border-[#FDECDC]",
  },
];

const features = [
  {
    icon: <Package className="h-6 w-6" />,
    title: "Products Management",
    text: "Easily manage your products, categories and stock levels in one place.",
  },
  {
    icon: <ClipboardList className="h-6 w-6" />,
    title: "Order Tracking",
    text: "Track orders from creation to delivery with real-time updates.",
  },
  {
    icon: <Users className="h-6 w-6" />,
    title: "Supplier Management",
    text: "Manage your suppliers, contracts and purchase orders efficiently.",
  },
  {
    icon: <BarChart3 className="h-6 w-6" />,
    title: "Stock Monitoring",
    text: "Get real-time insights into stock levels and avoid shortages or overstock.",
  },
];

/* ---------- Shared pieces ---------- */

function SectionHeading({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: ReactNode;
  text?: string;
}) {
  return (
    <div className="mx-auto mb-10 max-w-2xl text-center">
      <div className="mb-3 flex items-center justify-center gap-3">
        <span className="h-0.5 w-8 bg-[#FA6F10]" />
        <span className="text-xs font-semibold uppercase tracking-widest text-[#FA6F10]">
          {eyebrow}
        </span>
        <span className="h-0.5 w-8 bg-[#FA6F10]" />
      </div>
      <h2 className="text-3xl font-bold leading-tight text-[#10223A] sm:text-4xl">{title}</h2>
      {text && <p className="mt-4 leading-relaxed text-[#5B6B7F]">{text}</p>}
    </div>
  );
}

function IconBadge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex items-center justify-center rounded-xl bg-[#FDECDC] text-[#FA6F10] ${className}`}>
      {children}
    </div>
  );
}

const sectionPad = "w-full px-4 sm:px-6 lg:px-10";

/* ---------- Page ---------- */

export default function AboutPage({
  heroImage = "/src/assets/image.png",
}: {
  heroImage?: string;
}) {
  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#FDFDFC] font-sans text-[#10223A]">
      {/* ===== Hero ===== */}
      <section className={`${sectionPad} bg-gradient-to-b from-[#FCF7F2] to-[#FDFDFC] pb-4 pt-12 sm:pt-16`}>
        <div className="mx-auto max-w-4xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FDECDC] bg-[#FDF6F0] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#E0600A]">
            <Sparkles className="h-3.5 w-3.5" />
            Our Purpose &amp; Story
          </span>

          <h1 className="mt-5 text-3xl font-bold leading-tight sm:text-5xl lg:text-6xl">
            Empowering Modern Retailers to Master Inventory Velocity
          </h1>

          <p className="mx-auto mt-5 max-w-2xl leading-relaxed text-[#5B6B7F]">
            {BRAND} was engineered specifically to eliminate chaos between store
            counters, stockrooms, and multi-channel fulfillment warehouses. We
            provide growing SMB operators with a single, calm, synchronized
            nervous system.
          </p>

          <ul className="mt-6 flex flex-wrap justify-center gap-2">
            {tags.map((t) => (
              <li
                key={t.label}
                className="flex items-center gap-2 rounded-full border border-[#E6E9EE] bg-white px-3 py-1.5 text-xs font-medium text-[#46566B] shadow-sm"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
                {t.label}
              </li>
            ))}
          </ul>
        </div>

        {/* Banner image */}
        <div className="relative mt-10 h-72 overflow-hidden rounded-3xl bg-gradient-to-br from-[#10223A] to-[#0B1A2C] shadow-xl shadow-[#0B1A2C]/10 sm:h-96 lg:h-[30rem]">
          <img
            src={heroImage}
            alt="Warehouse worker checking stock on a tablet"
            onError={(e) => (e.currentTarget.style.display = "none")}
            className="h-full w-full object-cover object-[center_35%]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#FDBA8C]">
              The Retail Reality
            </p>
            <blockquote className="mt-2 max-w-2xl text-base font-semibold leading-snug text-white sm:text-xl">
              “When physical shelves and online storefronts decouple, customer
              trust erodes. We build technology that restores certainty in every
              stock count.”
            </blockquote>
          </div>
        </div>
      </section>

      {/* ===== Mission & Vision ===== */}
      <section className={`${sectionPad} py-16 sm:py-20`}>
        <SectionHeading
          eyebrow="Our Mission & Vision"
          title={
            <>
              More Efficiency.
              <br className="hidden sm:block" /> Greater Growth.
            </>
          }
          text="Our mission is to provide a reliable and easy-to-use inventory and order management system that helps businesses reduce errors, save time, and make data-driven decisions."
        />

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {pillars.map((p, i) => (
            <article
              key={p.title}
              className={`rounded-2xl border p-7 ${p.bg} ${i === 2 ? "md:col-span-2 lg:col-span-1" : ""}`}
            >
              <IconBadge className="h-16 w-16">{p.icon}</IconBadge>
              <h3 className="mt-5 text-xl font-semibold">{p.title}</h3>
              <p className="mt-3 leading-relaxed text-[#5B6B7F]">{p.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ===== Key Features ===== */}
      <section className={`${sectionPad} bg-[#FDF6F0]/70 py-16 sm:py-20`}>
        <SectionHeading
          eyebrow="Key Features"
          title="Everything You Need"
          text="Our system comes with powerful features designed to make inventory and order management simple, fast, and reliable."
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <article
              key={f.title}
              className="rounded-2xl border border-[#FDECDC] bg-white p-6 shadow-sm shadow-[#7A3410]/5"
            >
              <IconBadge className="h-12 w-12">{f.icon}</IconBadge>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#5B6B7F]">{f.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className={`${sectionPad} py-16 sm:py-24`}>
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#DDE5F2] via-[#E4E9F6] to-[#E2E8F8] px-6 py-14 text-center sm:py-20">
          <div className="pointer-events-none absolute -top-24 left-2/3 h-64 w-96 -translate-x-1/2 rounded-full bg-[#F4B9B0]/50 blur-3xl" />

          <div className="relative mx-auto max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#C2461F]">
              Take Control Today
            </p>
            <h2 className="mt-3 text-3xl font-bold leading-tight text-[#14172B] sm:text-4xl">
              Ready to Unify Your In-Store and Digital Inventory?
            </h2>
            <p className="mx-auto mt-4 max-w-xl leading-relaxed text-[#5B5E72]">
              Join hundreds of high-growth retailers who have eliminated phantom
              stock and manual spreadsheets with {BRAND}.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href="#"
                className="w-full rounded-full bg-[#FF5A26] px-6 py-3 text-sm font-semibold text-white shadow-md shadow-[#FF5A26]/30 transition hover:bg-[#EA4A18] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A26] focus-visible:ring-offset-2 sm:w-auto"
              >
                Start 14-Day Free Trial
              </a>
              <a
                href="#"
                className="w-full rounded-full bg-[#FDF8F5] px-6 py-3 text-sm font-semibold text-[#14172B] shadow-sm transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#14172B] focus-visible:ring-offset-2 sm:w-auto"
              >
                Explore Interactive Demo
              </a>
            </div>

            <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-[#4A4D60]">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-[#1F8F6B]" /> No credit card required
              </li>
              <li className="flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-[#1F8F6B]" /> 5-minute guided setup
              </li>
              <li className="flex items-center gap-1.5">
                <RotateCcw className="h-4 w-4 text-[#1F8F6B]" /> Cancel anytime
              </li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}