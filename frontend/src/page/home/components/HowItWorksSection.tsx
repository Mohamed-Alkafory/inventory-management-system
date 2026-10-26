// import Reveal from "../../../components/motion/Reveal";
// import SectionHeading from "../../../components/ui/SectionHeading";
// import { useInView } from "../../../hooks/useInView";
// import { STEPS } from "../data/content";

// export default function HowItWorksSection() {
//   const { ref, inView } = useInView<HTMLOListElement>({ threshold: 0.3 });

//   return (
//     <section id="how-it-works" className="w-full scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20 lg:px-10">
//       <div className="mx-auto max-w-7xl">
//         <Reveal>
//           <SectionHeading
//             eyebrow="How It Works"
//             title="Up and Running in Three Steps"
//             text="No consultants, no complicated rollout. Start tracking the same day."
//           />
//         </Reveal>

//         <ol ref={ref} className="relative grid gap-10 md:grid-cols-3 md:gap-6">
//           {/* Connector line that draws itself between the steps */}
//           <div
//             aria-hidden="true"
//             className={`pointer-events-none absolute left-[16.7%] right-[16.7%] top-6 hidden h-0.5 origin-left rounded-full bg-primary-200 transition-transform duration-1000 ease-out motion-reduce:transition-none md:block ${inView ? "scale-x-100" : "scale-x-0"}`}
//           />
//           {STEPS.map((s, i) => (
//             <li key={s.title} className="relative text-center">
//               <Reveal delay={i * 220}>
//                 <div className="group">
//                   <div className="relative mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-600 text-lg font-bold text-white shadow-md shadow-primary-500/30 ring-8 ring-[#FDFDFC] transition duration-300 group-hover:scale-110 group-hover:bg-primary-500 motion-reduce:transition-none motion-reduce:group-hover:scale-100">
//                     {i + 1}
//                   </div>
//                   <h3 className="mt-5 text-lg font-semibold text-ink">{s.title}</h3>
//                   <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted">{s.text}</p>
//                 </div>
//               </Reveal>
//             </li>
//           ))}
//         </ol>
//       </div>
//     </section>
//   );
// }

import Reveal from "../../../components/motion/Reveal";
import SectionHeading from "../../../components/ui/SectionHeading";
import { useInView } from "../../../hooks/useInView";
import { STEPS } from "../data/content";

export default function HowItWorksSection() {
  const { ref, inView } = useInView<HTMLOListElement>({ threshold: 0.3 });

  return (
    <section
      id="how-it-works"
      className="w-full scroll-mt-20 px-4 py-16 sm:px-6 sm:py-24 lg:px-10"
    >
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <SectionHeading
            eyebrow="How It Works"
            title="Up and Running in Three Steps"
            text="No consultants, no complicated rollout. Start tracking the same day."
          />
        </Reveal>

        <ol
          ref={ref}
          className="relative mt-12 grid gap-10 md:grid-cols-3 md:gap-6"
        >
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute left-[16.7%] right-[16.7%] top-6 hidden h-0.5 origin-left rounded-full bg-[linear-gradient(90deg,rgba(255,107,0,0.18),rgba(255,107,0,0.45),rgba(255,107,0,0.18))] transition-transform duration-1000 ease-out motion-reduce:transition-none md:block ${inView ? "scale-x-100" : "scale-x-0"}`}
          />
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative text-center">
              <Reveal delay={i * 220}>
                <div className="group">
                  <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-600 text-lg font-bold text-white shadow-lg shadow-primary-500/25 ring-8 ring-[#FDFDFC] transition duration-300 group-hover:scale-105 group-hover:bg-primary-500 motion-reduce:transition-none motion-reduce:group-hover:scale-100">
                    {i + 1}
                  </div>
                  <div className="mx-auto mt-6 max-w-sm rounded-3xl border border-[#F2E5D8] bg-white px-6 py-6 shadow-sm transition duration-300 group-hover:-translate-y-1 group-hover:shadow-md motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
                    <h3 className="text-lg font-semibold text-ink">
                      {s.title}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-muted">
                      {s.text}
                    </p>
                  </div>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
