import { useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import {
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  Mail,
  MapPin,
  Phone,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import Button from "../../components/ui/Button";
import Reveal from "../../components/motion/Reveal";

const BRAND = "InRetail";

const contactCards = [
  {
    icon: <Users className="h-5 w-5" />,
    title: "Sales & Partnerships",
    text: "For new stores, expansion plans, and business inquiries.",
    email: "sales@inretail.com",
    phone: "+1 (555) 123-4567",
  },
  {
    icon: <ShieldCheck className="h-5 w-5" />,
    title: "Technical Support",
    text: "For integrations, system issues, and operational help.",
    email: "support@inretail.com",
    phone: "+1 (555) 987-6543",
  },
  {
    icon: <MapPin className="h-5 w-5" />,
    title: "Operations & Hubs",
    text: "For logistics, fulfillment hubs, and physical operations.",
    email: "ops@inretail.com",
    phone: "+1 (555) 246-8100",
  },
];

const stats = [
  { value: "99.8%", label: "Resolution rate" },
  { value: "4.9/5", label: "Customer satisfaction" },
  { value: "24/7", label: "Support availability" },
];

const faqs = [
  {
    q: `How does ${BRAND} support multi-store operations?`,
    a: "We help you manage inventory, orders, and operations across multiple locations from one centralized system.",
  },
  {
    q: "Can I integrate my existing systems with the platform?",
    a: "Yes, the platform is built to support integrations with POS, ERP, and e-commerce systems.",
  },
  {
    q: "What kind of support do you offer?",
    a: "We provide expert support for technical issues, onboarding, operations, and ongoing assistance.",
  },
  {
    q: "How long does onboarding usually take?",
    a: "Most teams can get started quickly with guided setup and support from our team.",
  },
];

const ranges = ["1 – 50", "51 – 200", "201 – 500", "501 – 1,000", "1,001+"];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}

export default function ContactPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    business: "",
    purpose: "",
    range: "201 – 500",
    message: "",
    agree: true,
  });

  const [open, setOpen] = useState<number | null>(0);

  const onChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    // TODO: send form to API
  };

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#FBFAF8] font-sans text-ink">
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-[linear-gradient(180deg,#FFF8F2_0%,#FBFAF8_100%)] px-4 pb-16 pt-16 sm:px-6 sm:pt-20 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <Reveal>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#F2E3D5] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary-600 shadow-sm">
                <Sparkles className="h-4 w-4" />
                Contact Us
              </div>
            </Reveal>

            <Reveal delay={100}>
              <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight text-ink sm:text-6xl">
                Let’s talk about your retail operations.
              </h1>
            </Reveal>

            <Reveal delay={200}>
              <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-muted sm:text-lg">
                Whether you’re expanding, optimizing operations, or need
                technical support, our team is ready to help you move faster and
                work smarter.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Contact cards */}
      <section className="px-4 pb-16 sm:px-6 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-3">
          {contactCards.map((card, i) => (
            <Reveal key={card.title} delay={i * 120} className="h-full">
              <div className="h-full rounded-[1.75rem] border border-[#F0E4D8] bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
                  {card.icon}
                </div>
                <h3 className="text-xl font-semibold text-ink">{card.title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted">{card.text}</p>

                <div className="mt-5 space-y-3 text-sm">
                  <a
                    href={`mailto:${card.email}`}
                    className="flex items-center gap-2 font-medium text-primary-600 hover:underline"
                  >
                    <Mail className="h-4 w-4" />
                    {card.email}
                  </a>
                  <a
                    href={`tel:${card.phone.replace(/[^\d+]/g, "")}`}
                    className="flex items-center gap-2 font-medium text-ink hover:underline"
                  >
                    <Phone className="h-4 w-4" />
                    {card.phone}
                  </a>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Form + info */}
      <section className="px-4 pb-20 sm:px-6 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal>
            <div className="rounded-[2rem] border border-[#F0E4D8] bg-white p-8 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary-600">
                Why {BRAND}
              </p>
              <h2 className="mt-4 text-3xl font-bold leading-tight text-ink sm:text-4xl">
                Real support from real retail experts.
              </h2>
              <p className="mt-5 text-base leading-8 text-muted">
                We’re not just a software provider — we’re a partner focused on
                helping your business run better every day.
              </p>

              <div className="mt-8 grid grid-cols-3 gap-4">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-[#F3E7DA] bg-[#FFF9F4] p-4 text-center"
                  >
                    <p className="text-2xl font-bold text-primary-600">
                      {stat.value}
                    </p>
                    <p className="mt-1 text-xs text-muted">{stat.label}</p>
                  </div>
                ))}
              </div>

              <ul className="mt-8 space-y-3 text-sm text-ink">
                {[
                  "Expert support",
                  "Fast response",
                  "Long-term partnership",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-600 text-white">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal delay={150}>
            <form
              onSubmit={onSubmit}
              className="rounded-[2rem] border border-[#F0E4D8] bg-white p-8 shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
                  <Send className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-ink">
                    Send us a message
                  </h3>
                  <p className="mt-1 text-sm text-muted">
                    Tell us what you need and we’ll get back to you quickly.
                  </p>
                </div>
              </div>

              <div className="mt-8 grid gap-5 sm:grid-cols-2">
                <Field label="Full Name">
                  <div className="relative">
                    <Users className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <input
                      name="name"
                      value={form.name}
                      onChange={onChange}
                      required
                      placeholder="Your full name"
                      className="h-12 w-full rounded-xl border border-[#F0E4D8] bg-[#FFF9F4] pl-10 pr-4 text-sm text-ink placeholder:text-muted focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    />
                  </div>
                </Field>

                <Field label="Work Email">
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={onChange}
                      required
                      placeholder="you@company.com"
                      className="h-12 w-full rounded-xl border border-[#F0E4D8] bg-[#FFF9F4] pl-10 pr-4 text-sm text-ink placeholder:text-muted focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    />
                  </div>
                </Field>

                <Field label="Business or Store Name">
                  <div className="relative">
                    <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <input
                      name="business"
                      value={form.business}
                      onChange={onChange}
                      required
                      placeholder="e.g. FreshMart"
                      className="h-12 w-full rounded-xl border border-[#F0E4D8] bg-[#FFF9F4] pl-10 pr-4 text-sm text-ink placeholder:text-muted focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    />
                  </div>
                </Field>

                <Field label="Inquiry Purpose">
                  <div className="relative">
                    <select
                      name="purpose"
                      value={form.purpose}
                      onChange={onChange}
                      required
                      className="h-12 w-full appearance-none rounded-xl border border-[#F0E4D8] bg-[#FFF9F4] px-4 pr-10 text-sm text-ink focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    >
                      <option value="" disabled>
                        Select a purpose
                      </option>
                      <option>Sales & Partnerships</option>
                      <option>Technical Support</option>
                      <option>Operations & Hubs</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  </div>
                </Field>
              </div>

              <div className="mt-6">
                <span className="mb-2 block text-sm font-medium text-ink">
                  Monthly Store Orders or Active SKU Count
                </span>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {ranges.map((range) => {
                    const active = form.range === range;
                    return (
                      <button
                        key={range}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, range }))}
                        className={`h-11 rounded-xl border text-sm font-medium transition ${
                          active
                            ? "border-primary-500 bg-primary-500 text-white shadow-sm"
                            : "border-[#F0E4D8] bg-white text-ink hover:border-primary-300"
                        }`}
                      >
                        {range}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6">
                <Field label="Your Message">
                  <textarea
                    name="message"
                    value={form.message}
                    onChange={onChange}
                    required
                    maxLength={1000}
                    placeholder="Tell us more about your business or how we can help..."
                    className="h-36 w-full resize-none rounded-xl border border-[#F0E4D8] bg-[#FFF9F4] px-4 py-3 text-sm text-ink placeholder:text-muted focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                </Field>
              </div>

              <label className="mt-5 flex items-start gap-3 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={form.agree}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, agree: e.target.checked }))
                  }
                  required
                  className="mt-1 h-4 w-4 accent-primary-500"
                />
                <span>
                  I agree to the processing of my personal data in accordance
                  with the{" "}
                  <a href="#" className="text-primary-600 underline">
                    Privacy Policy
                  </a>{" "}
                  and{" "}
                  <a href="#" className="text-primary-600 underline">
                    Terms of Service
                  </a>
                  .
                </span>
              </label>

              <Button
                type="submit"
                size="lg"
                fullWidth
                className="mt-6"
                leftIcon={<Send className="h-4 w-4" />}
                rightIcon={<ArrowRight className="h-4 w-4" />}
              >
                Send Inquiry
              </Button>
            </form>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 pb-20 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary-600">
                FAQ
              </p>
              <h2 className="mt-4 text-3xl font-bold text-ink sm:text-4xl">
                Frequently asked questions
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-muted">
                Quick answers to common questions about support, onboarding, and
                integrations.
              </p>
            </div>
          </Reveal>

          <div className="mt-10 space-y-4">
            {faqs.map((faq, i) => {
              const isOpen = open === i;
              return (
                <Reveal key={faq.q} delay={i * 80}>
                  <div className="rounded-2xl border border-[#F0E4D8] bg-white shadow-sm">
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : i)}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold text-ink"
                    >
                      {faq.q}
                      <ChevronDown
                        className={`h-4 w-4 text-primary-600 transition-transform duration-300 motion-reduce:transition-none ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    <div
                      className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
                        isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                      }`}
                    >
                      <div className="overflow-hidden">
                        <p className="px-5 pb-5 text-sm leading-7 text-muted">
                          {faq.a}
                        </p>
                      </div>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
