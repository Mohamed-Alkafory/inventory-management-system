import SectionHeading from "../../../components/ui/SectionHeading";
import { STEPS } from "../data/content";

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="w-full scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="How It Works"
          title="Up and Running in Three Steps"
          text="No consultants, no complicated rollout. Start tracking the same day."
        />

        <ol className="relative grid gap-10 md:grid-cols-3 md:gap-6">
          <div
            className="pointer-events-none absolute left-[16.7%] right-[16.7%] top-6 hidden h-px bg-[#FDECDC] md:block"
            aria-hidden="true"
          />
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative text-center">
              <div className="relative mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-600 text-lg font-bold text-white shadow-md shadow-primary-500/30 ring-8 ring-[#FDFDFC]">
                {i + 1}
              </div>
              <h3 className="mt-5 text-lg font-semibold text-ink">{s.title}</h3>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
