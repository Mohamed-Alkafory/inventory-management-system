import IconBadge from "../../../components/ui/IconBadge";
import SectionHeading from "../../../components/ui/SectionHeading";
import { FEATURES } from "../data/content";

export default function FeaturesSection() {
  return (
    <section id="features" className="w-full scroll-mt-20 bg-[#FDF6F0]/70 px-4 py-16 sm:px-6 sm:py-20 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="Key Features"
          title="Everything You Need"
          text="Powerful tools that make inventory and order management simple, fast and reliable."
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <article
              key={f.title}
              className="rounded-2xl border border-[#FDECDC] bg-white p-6 shadow-sm shadow-[#7A3410]/5 transition hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <IconBadge className="h-12 w-12">{f.icon}</IconBadge>
              <h3 className="mt-4 font-semibold text-ink">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
