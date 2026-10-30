import { useState } from "react";
import type { ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import type { Control } from "react-hook-form";
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronDown,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { z } from "zod";
import Button from "../../components/ui/Button";
import FormField from "../../components/ui/form/FormField";
import Reveal from "../../components/motion/Reveal";
import { useAuth } from "../../context/auth/useAuth";
import { publicContactApi } from "../../features/contact/publicApi";
import { ApiError } from "../../lib/http";

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

/** Limits mirror the backend `CreateContactMessageDto`. */
const MESSAGE_LIMIT = 5000;

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or fewer"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .max(255, "Email must be 255 characters or fewer")
    .email("Enter a valid email address"),
  subject: z
    .string()
    .trim()
    .min(1, "Subject is required")
    .max(200, "Subject must be 200 characters or fewer"),
  message: z
    .string()
    .trim()
    .min(1, "Message is required")
    .max(MESSAGE_LIMIT, "Message must be 5,000 characters or fewer"),
  // Optional on the backend, but the form always sends it (empty for humans).
  honeypot: z.string().max(255, "Honeypot is too long"),
});

type ContactFormValues = z.infer<typeof schema>;

function inputClass(invalid: boolean) {
  return `h-12 w-full rounded-xl border bg-[#FFF9F4] pl-10 pr-4 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 ${
    invalid
      ? "border-danger-600 focus:border-danger-600 focus:ring-danger-600/20"
      : "border-[#F0E4D8] focus:border-primary-500 focus:ring-primary-500/20"
  }`;
}

function textareaClass(invalid: boolean) {
  return `h-36 w-full resize-none rounded-xl border bg-[#FFF9F4] px-4 py-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 ${
    invalid
      ? "border-danger-600 focus:border-danger-600 focus:ring-danger-600/20"
      : "border-[#F0E4D8] focus:border-primary-500 focus:ring-primary-500/20"
  }`;
}

type ContactInputProps = {
  control: Control<ContactFormValues>;
  name: "name" | "email" | "subject";
  label: string;
  icon: ReactNode;
  placeholder: string;
  type?: "text" | "email";
  autoComplete?: string;
  className?: string;
};

function ContactInput({
  control,
  name,
  label,
  icon,
  placeholder,
  type = "text",
  autoComplete,
  className,
}: ContactInputProps) {
  return (
    <FormField control={control} name={name} label={label} required className={className}>
      {({ field, aria }) => {
        const { invalid, ...ariaProps } = aria;
        return (
          <div className="relative">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            >
              {icon}
            </span>
            <input
              {...field}
              {...ariaProps}
              type={type}
              autoComplete={autoComplete}
              placeholder={placeholder}
              aria-invalid={invalid || undefined}
              className={inputClass(invalid)}
            />
          </div>
        );
      }}
    </FormField>
  );
}

export default function ContactPage() {
  const { user } = useAuth();
  const [open, setOpen] = useState<number | null>(0);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
  } = useForm<ContactFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: user?.name ?? "",
      email: user?.email ?? "",
      subject: "",
      message: "",
      honeypot: "",
    },
    mode: "onTouched",
  });

  const message = useWatch({ control, name: "message" });
  const messageLength = message?.length ?? 0;

  const submit = useMutation({
    mutationFn: (values: ContactFormValues) =>
      publicContactApi.submit({
        name: values.name,
        email: values.email,
        subject: values.subject,
        message: values.message,
        honeypot: values.honeypot ?? "",
      }),
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await submit.mutateAsync(values);
    } catch (err) {
      if (err instanceof ApiError) {
        const fields: Array<"name" | "email" | "subject" | "message"> = [
          "name",
          "email",
          "subject",
          "message",
        ];
        let hasFieldError = false;
        for (const key of fields) {
          const message = err.fieldErrors[key];
          if (message) {
            setError(key, { type: "server", message });
            hasFieldError = true;
          }
        }
        if (hasFieldError) {
          setFormError("Please fix the highlighted fields and try again.");
        } else if (err.status === 429) {
          setFormError("Too many messages from this device. Please try again later.");
        } else if (err.status === 0) {
          setFormError(err.message);
        } else {
          setFormError("Something went wrong on our end. Please try again.");
        }
        return;
      }
      setFormError("Something went wrong. Please try again.");
    }
  });

  const sendAnother = () => {
    submit.reset();
    setFormError(null);
    reset();
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
            <div className="rounded-[2rem] border border-[#F0E4D8] bg-white p-8 shadow-sm">
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

              {submit.isSuccess ? (
                <div className="mt-8 rounded-2xl border border-[#F3E7DA] bg-[#FFF9F4] px-6 py-10 text-center">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-600 text-white">
                    <Check className="h-7 w-7" strokeWidth={3} />
                  </span>
                  <h4 className="mt-5 text-2xl font-bold text-ink">
                    Message sent
                  </h4>
                  <p className="mx-auto mt-3 max-w-sm text-sm leading-7 text-muted">
                    Thanks for reaching out. Our team has received your message
                    and will get back to you soon.
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    className="mt-6"
                    leftIcon={<Send className="h-4 w-4" />}
                    onClick={sendAnother}
                  >
                    Send another message
                  </Button>
                </div>
              ) : (
                <form
                  onSubmit={onSubmit}
                  noValidate
                  className="relative mt-8"
                >
                  {/* Off-screen honeypot: bots fill it, humans never see it. */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -left-[9999px] top-0 h-px w-px overflow-hidden"
                  >
                    <label htmlFor="contact-honeypot">
                      Leave this field empty
                    </label>
                    <input
                      id="contact-honeypot"
                      {...register("honeypot")}
                      tabIndex={-1}
                      autoComplete="off"
                    />
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <ContactInput
                      control={control}
                      name="name"
                      label="Full Name"
                      icon={<Users className="h-4 w-4" />}
                      autoComplete="name"
                      placeholder="Your full name"
                    />

                    <ContactInput
                      control={control}
                      name="email"
                      label="Work Email"
                      icon={<Mail className="h-4 w-4" />}
                      type="email"
                      autoComplete="email"
                      placeholder="you@company.com"
                    />

                    <ContactInput
                      control={control}
                      name="subject"
                      label="Subject"
                      icon={<MessageSquare className="h-4 w-4" />}
                      autoComplete="off"
                      placeholder="How can we help?"
                      className="sm:col-span-2"
                    />
                  </div>

                  <div className="mt-6">
                    <FormField
                      control={control}
                      name="message"
                      label="Your Message"
                      required
                    >
                      {({ field, aria }) => {
                        const { invalid, ...ariaProps } = aria;
                        return (
                          <textarea
                            {...field}
                            {...ariaProps}
                            rows={6}
                            maxLength={MESSAGE_LIMIT}
                            placeholder="Tell us more about your business or how we can help..."
                            aria-invalid={invalid || undefined}
                            className={textareaClass(invalid)}
                          />
                        );
                      }}
                    </FormField>
                    <div className="mt-1 flex justify-end text-xs text-muted">
                      <span aria-live="polite">
                        {messageLength.toLocaleString()} /{" "}
                        {MESSAGE_LIMIT.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {formError && (
                    <div
                      role="alert"
                      className="mt-5 flex items-start gap-2 rounded-xl border border-danger-600/30 bg-danger-50 px-4 py-3 text-sm text-danger-700"
                    >
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    size="lg"
                    fullWidth
                    className="mt-6"
                    loading={submit.isPending}
                    leftIcon={
                      submit.isPending ? undefined : <Send className="h-4 w-4" />
                    }
                    rightIcon={
                      submit.isPending ? undefined : (
                        <ArrowRight className="h-4 w-4" />
                      )
                    }
                  >
                    {submit.isPending ? "Sending…" : "Send Inquiry"}
                  </Button>
                </form>
              )}
            </div>
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
