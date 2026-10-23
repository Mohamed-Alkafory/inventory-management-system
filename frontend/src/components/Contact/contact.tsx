import { useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import {
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  Home,
  Mail,
  Phone,
  Send,
  Settings,
  User,
  Users,
} from "lucide-react";

/*
  Palette (sampled from the design)
  ink     #0E2A66   headings
  muted   #5576AE   body text
  orange  #FF5A26   buttons / accents
  field   #F7FBFE   input background, border #D7EAF8
*/

const BRAND = "InRetail";

/* ---------- Data ---------- */

const assurances = ["Expert support", "Faster response", "Long-term partnership"];

const contacts = [
  {
    icon: <Users className="h-6 w-6 text-[#FF5A26]" />,
    circle: "bg-[#FDEEE8]",
    title: "Sales & Multi-Store Expansion",
    text: "Talk to our sales team about new store openings, partnerships, and multi-location expansion. We’ll help you find the right solution for your growing business.",
    email: "sales@inretail.com",
    phone: "+1 (555) 123-4567",
  },
  {
    icon: <Settings className="h-6 w-6 text-[#1E4FA8]" />,
    circle: "bg-[#E6EFFB]",
    title: "Operations & Technical Desk",
    text: "Get help with day-to-day operations, system integrations, API support and technical troubleshooting from our operations and technical experts.",
    email: "ops@inretail.com",
    phone: "+1 (555) 987-6543",
  },
  {
    icon: <Home className="h-6 w-6 text-[#1F9D6B]" />,
    circle: "bg-[#E4F6EE]",
    title: "Physical Operations & Hubs",
    text: "Inquiries about our fulfillment hubs, inventory handling, logistics and physical operations? Our operations team is here to support you.",
    email: "hubs@inretail.com",
    phone: "+1 (555) 246-8100",
  },
];

const purposes = contacts.map((c) => c.title);
const ranges = ["1 – 50", "51 – 200", "201 – 500", "501 – 1,000", "1,001+"];

const stats = [
  { value: "99.8%", label: "Issue Resolution Rate" },
  { value: "4.9 / 5", label: "Customer Satisfaction" },
  { value: "24/7", label: "Support Availability" },
];

const faqs = [
  { q: `How does ${BRAND} support multi-store operations and inventory management?`, a: "" },
  { q: `Can I integrate my existing POS, ERP, or e-commerce systems with ${BRAND}?`, a: "" },
  { q: "What kind of support do you offer for technical issues and system downtime?", a: "" },
  { q: "How long does it typically take to onboard a new store or location?", a: "" },
];

/* ---------- Shared ---------- */

const pad = "w-full px-4 sm:px-6 lg:px-10";
const card = "rounded-2xl border border-[#E6EFFA] bg-white shadow-[0_2px_14px_rgba(30,64,140,0.06)]";
const fieldBase =
  "h-11 w-full rounded-lg border border-[#D7EAF8] bg-[#F7FBFE] text-sm text-[#0E2A66] placeholder:text-[#92AED1] focus:border-[#FF5A26] focus:outline-none focus:ring-2 focus:ring-[#FF5A26]/20";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-[#12307A]">
        {label} <span className="text-[#FF5A26]">*</span>
      </span>
      {children}
    </label>
  );
}

/* ---------- Page ---------- */

export default function ContactPage({
  teamImage = "/src/assets/team.jpg",
  mapImage = "/src/assets/world-map.jpg",
}: {
  teamImage?: string;
  mapImage?: string;
}) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    business: "",
    purpose: "",
    range: "201 – 500",
    message: "",
    agree: true,
  });
  const [open, setOpen] = useState<number | null>(null);

  const onChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    // TODO: send `form` to your API
  };



  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#FAFCFD] font-sans text-[#0E2A66]">
      {/* ===== Hero ===== */}
      <section className={`${pad} bg-[#F4F9FE] pb-10 pt-12 text-center sm:pt-14`}>
        <div className="flex items-center justify-center gap-3">
          <span className="h-0.5 w-6 bg-[#FF5A26]" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-[#FF5A26]">Contact Our Team</span>
        </div>

        <h1 className="mx-auto mt-4 max-w-3xl text-3xl font-extrabold leading-tight sm:text-5xl">
          We’re Here to Help Your Retail Operations Thrive
        </h1>

        <p className="mx-auto mt-5 max-w-2xl leading-relaxed text-[#5576AE]">
          Whether you’re expanding to new stores, optimizing operations, or need technical support — our team is
          ready to help you move faster and operate smarter.
        </p>

        <ul className="mt-6 flex flex-wrap items-center justify-center gap-y-3 text-sm font-medium text-[#12307A]">
          {assurances.map((a, i) => (
            <li
              key={a}
              className={`flex items-center gap-2 px-5 ${i > 0 ? "sm:border-l sm:border-[#D7E3F4]" : ""}`}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#12307A] text-white">
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              {a}
            </li>
          ))}
        </ul>
      </section>

      {/* ===== Contact cards + form ===== */}
      <section className={`${pad} py-6`}>
        <div className="grid items-start gap-5 lg:grid-cols-2">
          {/* Left column */}
          <div className="space-y-4">
            {contacts.map((c) => (
              <article key={c.title} className={`relative flex gap-4 p-5 ${card}`}>
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${c.circle}`}>
                  {c.icon}
                </div>
                <div className="min-w-0 pr-6">
                  <h3 className="font-bold text-[#0E2A66]">{c.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#5576AE]">{c.text}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                    <a href={`mailto:${c.email}`} className="flex items-center gap-2 font-medium text-[#FF5A26] hover:underline">
                      <Mail className="h-4 w-4" />
                      {c.email}
                    </a>
                    <span className="hidden h-5 w-px bg-[#D7E3F4] sm:block" />
                    <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="flex items-center gap-2 font-medium text-[#12307A] hover:underline">
                      <Phone className="h-4 w-4" />
                      {c.phone}
                    </a>
                  </div>
                </div>
                <ChevronRight className="absolute right-5 top-5 h-4 w-4 text-[#5576AE]" />
              </article>
            ))}

            <article className={`flex items-center gap-5 p-4 ${card}`}>
              <img
                src={mapImage}
                alt="World map with regional offices"
                className="h-28 w-2/5 shrink-0 rounded-xl bg-[#E6F1FC] object-cover"
              />
              <div>
                <h3 className="font-bold text-[#0E2A66]">Our Global Presence</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[#5576AE]">
                  We operate across multiple regions with local support teams.
                </p>
                <a href="#" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-[#FF5A26] hover:underline">
                  View all locations <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </article>
          </div>

          {/* Form */}
          <form onSubmit={onSubmit} className={`p-6 sm:p-7 ${card}`}>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#E6EFFB] text-[#1E4FA8]">
                <Send className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#0E2A66]">Send your retail team a message</h2>
                <p className="mt-0.5 text-xs text-[#5576AE]">
                  Tell us about your needs and we’ll get back to you as soon as possible.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Full Name">
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5576AE]" />
                  <input name="name" value={form.name} onChange={onChange} required placeholder="Your full name" className={`${fieldBase} pl-10 pr-3`} />
                </div>
              </Field>
              <Field label="Work Email">
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5576AE]" />
                  <input type="email" name="email" value={form.email} onChange={onChange} required placeholder="you@company.com" className={`${fieldBase} pl-10 pr-3`} />
                </div>
              </Field>
              <Field label="Business or Store Name">
                <div className="relative">
                  <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5576AE]" />
                  <input name="business" value={form.business} onChange={onChange} required placeholder="e.g. FreshMart, Retail Co." className={`${fieldBase} pl-10 pr-3`} />
                </div>
              </Field>
              <Field label="Inquiry Purpose">
                <div className="relative">
                  <select
                    name="purpose"
                    value={form.purpose}
                    onChange={onChange}
                    required
                    className={`${fieldBase} appearance-none px-3 pr-9 ${form.purpose ? "" : "text-[#5576AE]"}`}
                  >
                    <option value="" disabled>
                      Select a purpose
                    </option>
                    {purposes.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5576AE]" />
                </div>
              </Field>
            </div>

            <fieldset className="mt-5">
              <legend className="mb-1.5 text-xs font-semibold text-[#12307A]">
                Monthly Store Orders or Active SKU Count <span className="text-[#FF5A26]">*</span>
              </legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {ranges.map((r) => {
                  const active = form.range === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setForm((f) => ({ ...f, range: r }))}
                      className={`h-10 rounded-lg border text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A26]/40 ${
                        active
                          ? "border-[#FF5A26] bg-[#FF5A26] text-white shadow-sm shadow-[#FF5A26]/30"
                          : "border-[#D7EAF8] bg-white text-[#12307A] hover:border-[#FF5A26]/50"
                      }`}
                    >
                      {r}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="mt-5">
              <Field label="Your Message">
                <div className="relative">
                  <textarea
                    name="message"
                    value={form.message}
                    onChange={onChange}
                    required
                    maxLength={1000}
                    placeholder="Please tell us more about your business, your goals, or how we can help..."
                    className={`${fieldBase} h-32 resize-none px-3 py-3`}
                  />
                  <span className="pointer-events-none absolute bottom-2 right-3 text-[10px] text-[#92AED1]">
                    {form.message.length}/1000
                  </span>
                </div>
              </Field>
            </div>

            <label className="mt-4 flex items-start gap-2.5 text-xs leading-relaxed text-[#12307A]">
              <input
                type="checkbox"
                checked={form.agree}
                onChange={(e) => setForm((f) => ({ ...f, agree: e.target.checked }))}
                required
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#FF5A26]"
              />
              <span>
                I agree to the processing of my personal data in accordance with the{" "}
                <a href="#" className="text-[#FF5A26] underline">Privacy Policy</a> and{" "}
                <a href="#" className="text-[#FF5A26] underline">Terms of Service</a>.
              </span>
            </label>

            <button
              type="submit"
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#FF5A26] text-sm font-semibold text-white shadow-md shadow-[#FF5A26]/30 transition hover:bg-[#EA4A18] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A26] focus-visible:ring-offset-2"
            >
              <Send className="h-4 w-4" />
              Send Inquiry
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>
      </section>

      {/* ===== Why ===== */}
      <section className={`${pad} py-12 sm:py-16`}>
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <div className="flex items-center gap-3">
              <span className="h-0.5 w-6 bg-[#FF5A26]" />
              <span className="text-[11px] font-semibold uppercase tracking-widest text-[#FF5A26]">Why {BRAND}</span>
            </div>
            <h2 className="mt-4 text-3xl font-extrabold leading-tight sm:text-4xl">
              Real Retail Engineers.
              <br className="hidden sm:block" /> Not Outsourced Ticket Queues.
            </h2>
            <p className="mt-5 max-w-lg leading-relaxed text-[#5576AE]">
              We’re a dedicated team of retail engineers, product specialists and operations experts — focused on
              your success. No third parties, no ticket queues, just real people who understand retail.
            </p>

            <dl className="mt-8 flex flex-wrap gap-y-4">
              {stats.map((s, i) => (
                <div key={s.label} className={`pr-6 ${i > 0 ? "border-l border-[#D7E3F4] pl-6" : ""}`}>
                  <dd className="text-3xl font-extrabold text-[#FF5A26]">{s.value}</dd>
                  <dt className="mt-1 text-xs text-[#5576AE]">{s.label}</dt>
                </div>
              ))}
            </dl>
          </div>

          <img
            src={teamImage}
            alt="The support team collaborating around a table"
            className="aspect-[2/1] w-full rounded-2xl bg-[#E6F1FC] object-cover shadow-lg shadow-[#0E2A66]/10"
          />
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className={`${pad} pb-16 pt-4 sm:pb-24`}>
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#FF5A26]">
            Frequently Asked Questions
          </p>
          <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">Everything You Need to Know Before Connecting</h2>
          <p className="mt-2 text-sm text-[#5576AE]">
            Find answers to the most common questions about our platform, support and operations.
          </p>

          <ul className="mt-8 space-y-3 text-left">
            {faqs.map((f, i) => {
              const isOpen = open === i;
              return (
                <li key={f.q} className={card}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-4 rounded-2xl px-5 py-4 text-left text-sm font-semibold text-[#12307A] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A26]/40"
                  >
                    {f.q}
                    <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen && f.a && <p className="px-5 pb-4 text-sm leading-relaxed text-[#5576AE]">{f.a}</p>}
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </main>
  );
}