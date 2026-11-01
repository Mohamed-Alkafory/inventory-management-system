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
import { useInView } from "../../hooks/useInView";
import { BRAND } from "../../lib/brand";
import { ApiError } from "../../lib/http";

const contactCards = [
  {
    icon: <Users className="h-5 w-5" />,
    title: "Sales & Partnerships",
    text: "For new accounts, partnerships and general business inquiries.",
    email: "sales@prodexa.com",
    phone: "+1 (555) 123-4567",
  },
  {
    icon: <ShieldCheck className="h-5 w-5" />,
    title: "Technical Support",
    text: "For account access, system issues and day-to-day help.",
    email: "support@prodexa.com",
    phone: "+1 (555) 987-6543",
  },
  {
    icon: <MapPin className="h-5 w-5" />,
    title: "Order Support",
    text: "For questions about orders, stock and deliveries.",
    email: "orders@prodexa.com",
    phone: "+1 (555) 246-8100",
  },
];

const stats = [
  { value: "4", label: "User roles" },
  { value: "1", label: "Shared inbox" },
  { value: "3", label: "Message statuses" },
];

const contactSteps = [
  {
    icon: <Send className="h-5 w-5" />,
    title: "Send your message",
    text: "Fill in the form above with your question or request — it takes less than a minute.",
  },
  {
    icon: <MessageSquare className="h-5 w-5" />,
    title: "It reaches our inbox",
    text: "Your message lands in our shared support inbox, where it is tracked and assigned to the right person.",
  },
  {
    icon: <Mail className="h-5 w-5" />,
    title: "We reply by email",
    text: "We get back to you at the email you provide, so keep an eye on your inbox for our reply.",
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
  const [formError, setFormError] = useState<string | null>(null);
  const { ref: stepsRef, inView: stepsInView } = useInView<HTMLOListElement>({ threshold: 0.3 });

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
                Support that understands your workflow.
              </h2>
              <p className="mt-5 text-base leading-8 text-muted">
                From your first setup question to a day-to-day stock issue, our
                team helps you get the most out of the system.
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
                  "Guided onboarding",
                  "In-app message tracking",
                  "Clear, practical answers",
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

      {/* What happens next */}
      <section className="px-4 pb-20 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary-600">
                What Happens Next
              </p>
              <h2 className="mt-4 text-3xl font-bold text-ink sm:text-4xl">
                From your message to our reply
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-muted">
                Every message lands in our shared support inbox, where it is tracked
                through to resolution. Here is what to expect after you hit send.
              </p>
            </div>
          </Reveal>

          <ol ref={stepsRef} className="relative mt-12 grid gap-10 md:grid-cols-3 md:gap-6">
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute left-[16.7%] right-[16.7%] top-6 hidden h-0.5 origin-left rounded-full bg-linear-to-r from-primary-200 via-primary-400 to-primary-200 transition-transform duration-1000 ease-out motion-reduce:transition-none md:block ${
                stepsInView ? "scale-x-100" : "scale-x-0"
              }`}
            />

            {contactSteps.map((s, i) => (
              <li key={s.title} className="relative text-center">
                <Reveal delay={i * 180}>
                  <div className="group">
                    <div className="relative mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-primary-200 bg-white text-primary-600 shadow-sm ring-8 ring-[#FBFAF8] transition duration-300 group-hover:scale-110 group-hover:border-primary-400 group-hover:bg-primary-50 motion-reduce:transition-none motion-reduce:group-hover:scale-100">
                      {s.icon}
                    </div>
                    <p className="mt-5 text-xs font-semibold uppercase tracking-widest text-primary-600">
                      Step {i + 1}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-ink">{s.title}</h3>
                    <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted">
                      {s.text}
                    </p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>

          <Reveal delay={240}>
            <p className="mx-auto mt-10 max-w-xl rounded-2xl border border-[#F0E4D8] bg-white px-5 py-4 text-center text-sm text-muted shadow-sm">
              <span className="font-semibold text-ink">Tip:</span> include your order
              number or product name where relevant, and we can help faster.
            </p>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
