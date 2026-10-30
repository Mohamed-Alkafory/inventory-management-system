import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import Reveal from "../motion/Reveal";

type Props = {
  badge: { icon: LucideIcon; label: string };
  heading: string;
  text: string;
  highlights: { icon: LucideIcon; text: string }[];
  children: ReactNode;
};

/** Two-column layout shared by Login and Register: animated brand panel + form area. */
export default function AuthShell({ badge, heading, text, highlights, children }: Props) {
  const BadgeIcon = badge.icon;

  return (
    <main className="grid min-h-[calc(100vh_-_var(--header-h))] w-full bg-[#FDFDFC] font-sans text-ink lg:grid-cols-2">
      <section className="relative isolate hidden overflow-hidden bg-linear-to-br from-primary-600 via-primary-500 to-[#FF8A3D] p-12 text-white lg:flex lg:flex-col lg:justify-center">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-16 -top-20 h-80 w-80 animate-blob rounded-full bg-white/15 blur-3xl motion-reduce:animate-none" />
          <div
            className="absolute -bottom-24 right-0 h-96 w-96 animate-blob rounded-full bg-[#7A2B00]/30 blur-3xl motion-reduce:animate-none"
            style={{ animationDelay: "-7s" }}
          />
        </div>

        <Reveal>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur">
            <BadgeIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {badge.label}
          </span>
        </Reveal>
        <Reveal delay={100}>
          <h2 className="mt-6 max-w-md text-4xl font-bold leading-tight">{heading}</h2>
        </Reveal>
        <Reveal delay={200}>
          <p className="mt-4 max-w-md leading-relaxed text-white/85">{text}</p>
        </Reveal>

        <ul className="mt-10 space-y-4">
          {highlights.map(({ icon: Icon, text: t }, i) => (
            <li key={t}>
              <Reveal delay={300 + i * 120} direction="left">
                <div className="flex items-center gap-3 text-sm font-medium">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  {t}
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex items-center justify-center px-4 py-12 sm:px-6">
        <Reveal className="w-full max-w-md">
          <div className="rounded-3xl border border-[#FDECDC] bg-white p-6 shadow-xl shadow-[#7A3410]/10 sm:p-8">
            {children}
          </div>
        </Reveal>
      </section>
    </main>
  );
}
