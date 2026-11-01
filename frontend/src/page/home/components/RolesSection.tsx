import Reveal from "../../../components/motion/Reveal";
import IconBadge from "../../../components/ui/IconBadge";
import SectionHeading from "../../../components/ui/SectionHeading";
import { spotlightHandler } from "../../../hooks/useSpotlight";
import { ROLES } from "../data/content";

export default function RolesSection() {
  return (
    <section className="w-full px-4 py-16 sm:px-6 sm:py-20 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <SectionHeading
            eyebrow="Made for Your Team"
            title="Built for Every Role"
            text="One system, four clear workspaces — everyone gets exactly the access they need to do their job."
          />
        </Reveal>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ROLES.map((r, i) => (
            <Reveal key={r.title} delay={i * 110} className="h-full">
              <article
                onPointerMove={spotlightHandler}
                className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-[#FDECDC] bg-white p-6 shadow-sm shadow-[#7A3410]/5 transition duration-300 before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(220px_circle_at_var(--mx,50%)_var(--my,50%),rgba(255,107,0,0.12),transparent_70%)] before:opacity-0 before:transition-opacity before:duration-300 hover:-translate-y-1 hover:border-primary-200 hover:shadow-lg hover:before:opacity-100 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <IconBadge className="relative h-12 w-12 transition duration-300 group-hover:scale-110 group-hover:-rotate-6 motion-reduce:transition-none motion-reduce:group-hover:scale-100 motion-reduce:group-hover:rotate-0">
                  {r.icon}
                </IconBadge>

                <h3 className="relative mt-4 text-lg font-semibold text-ink">{r.title}</h3>
                <p className="relative mt-1 text-sm text-muted">{r.text}</p>

                <ul className="relative mt-4 space-y-2 border-t border-[#FDECDC] pt-4">
                  {r.points.map((p) => (
                    <li key={p} className="flex items-center gap-2 text-sm text-ink">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" aria-hidden="true" />
                      {p}
                    </li>
                  ))}
                </ul>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
