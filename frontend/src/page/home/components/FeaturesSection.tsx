// import Reveal from "../../../components/motion/Reveal";
// import IconBadge from "../../../components/ui/IconBadge";
// import SectionHeading from "../../../components/ui/SectionHeading";
// import { spotlightHandler } from "../../../hooks/useSpotlight";
// import { FEATURES } from "../data/content";

// export default function FeaturesSection() {
//   return (
//     <section id="features" className="w-full scroll-mt-20 bg-[#FDF6F0]/70 px-4 py-16 sm:px-6 sm:py-20 lg:px-10">
//       <div className="mx-auto max-w-7xl">
//         <Reveal>
//           <SectionHeading
//             eyebrow="Key Features"
//             title="Everything You Need"
//             text="Powerful tools that make inventory and order management simple, fast and reliable."
//           />
//         </Reveal>

//         <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
//           {FEATURES.map((f, i) => (
//             <Reveal key={f.title} delay={(i % 3) * 120} className="h-full">
//               <article
//                 onPointerMove={spotlightHandler}
//                 className="group relative h-full overflow-hidden rounded-2xl border border-[#FDECDC] bg-white p-6 shadow-sm shadow-[#7A3410]/5 transition duration-300 before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(220px_circle_at_var(--mx,50%)_var(--my,50%),rgba(255,107,0,0.12),transparent_70%)] before:opacity-0 before:transition-opacity before:duration-300 hover:-translate-y-1 hover:border-primary-200 hover:shadow-lg hover:before:opacity-100 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
//               >
//                 <IconBadge className="relative h-12 w-12 transition duration-300 group-hover:scale-110 group-hover:-rotate-6 group-hover:bg-primary-500 group-hover:text-white motion-reduce:transition-none motion-reduce:group-hover:scale-100 motion-reduce:group-hover:rotate-0">
//                   {f.icon}
//                 </IconBadge>
//                 <h3 className="relative mt-4 font-semibold text-ink">{f.title}</h3>
//                 <p className="relative mt-2 text-sm leading-relaxed text-muted">{f.text}</p>
//               </article>
//             </Reveal>
//           ))}
//         </div>
//       </div>
//     </section>
//   );
// }
import Reveal from "../../../components/motion/Reveal";
import IconBadge from "../../../components/ui/IconBadge";
import SectionHeading from "../../../components/ui/SectionHeading";
import { spotlightHandler } from "../../../hooks/useSpotlight";
import { FEATURES } from "../data/content";

export default function FeaturesSection() {
  return (
    <section
      id="features"
      className="w-full scroll-mt-20 bg-[linear-gradient(180deg,#FFF9F4_0%,#FDFDFC_100%)] px-4 py-16 sm:px-6 sm:py-24 lg:px-10"
    >
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <SectionHeading
            eyebrow="Key Features"
            title="Everything You Need"
            text="Powerful tools that make inventory and order management simple, fast and reliable."
          />
        </Reveal>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 120} className="h-full">
              <article
                onPointerMove={spotlightHandler}
                className="group relative h-full overflow-hidden rounded-[1.5rem] border border-[#F2E5D8] bg-white p-6 shadow-[0_12px_35px_-28px_rgba(122,52,16,0.35)] transition duration-300 before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(240px_circle_at_var(--mx,50%)_var(--my,50%),rgba(255,107,0,0.12),transparent_72%)] before:opacity-0 before:transition-opacity before:duration-300 hover:-translate-y-1 hover:border-primary-200 hover:shadow-[0_24px_50px_-30px_rgba(122,52,16,0.45)] hover:before:opacity-100 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <div className="relative">
                  <IconBadge className="h-12 w-12 rounded-2xl transition duration-300 group-hover:scale-110 group-hover:-rotate-6 group-hover:bg-primary-500 group-hover:text-white motion-reduce:transition-none motion-reduce:group-hover:scale-100 motion-reduce:group-hover:rotate-0">
                    {f.icon}
                  </IconBadge>
                  <h3 className="mt-5 text-lg font-semibold text-ink">
                    {f.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-muted">{f.text}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
