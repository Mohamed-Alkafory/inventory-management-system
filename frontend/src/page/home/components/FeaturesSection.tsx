import Reveal from "../../../components/motion/Reveal";
import IconBadge from "../../../components/ui/IconBadge";
import SectionHeading from "../../../components/ui/SectionHeading";
import { spotlightHandler } from "../../../hooks/useSpotlight";
import { FEATURES } from "../data/content";

export default function FeaturesSection() {
  return (
    <section id="features" className="w-full scroll-mt-20 bg-[#FDF6F0]/70 px-4 py-16 sm:px-6 sm:py-20 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <SectionHeading
            eyebrow="Key Features"
            title="Everything You Need"
            text="Powerful tools that make inventory and order management simple, fast and reliable."
          />
        </Reveal>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 120} className="h-full">
              <article
                onPointerMove={spotlightHandler}
                className="group relative h-full overflow-hidden rounded-2xl border border-[#FDECDC] bg-white p-6 shadow-sm shadow-[#7A3410]/5 transition duration-300 before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(220px_circle_at_var(--mx,50%)_var(--my,50%),rgba(255,107,0,0.12),transparent_70%)] before:opacity-0 before:transition-opacity before:duration-300 hover:-translate-y-1 hover:border-primary-200 hover:shadow-lg hover:before:opacity-100 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <IconBadge className="relative h-12 w-12 transition duration-300 group-hover:scale-110 group-hover:-rotate-6 group-hover:bg-primary-500 group-hover:text-white motion-reduce:transition-none motion-reduce:group-hover:scale-100 motion-reduce:group-hover:rotate-0">
                  {f.icon}
                </IconBadge>
                <h3 className="relative mt-4 font-semibold text-ink">{f.title}</h3>
                <p className="relative mt-2 text-sm leading-relaxed text-muted">{f.text}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
