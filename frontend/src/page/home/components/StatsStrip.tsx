// import CountUp from "../../../components/motion/CountUp";
// import Reveal from "../../../components/motion/Reveal";
// import { STATS } from "../data/content";

// export default function StatsStrip() {
//   return (
//     <section className="w-full px-4 py-10 sm:px-6 lg:px-10">
//       <Reveal className="mx-auto max-w-7xl">
//         <dl className="grid grid-cols-2 gap-y-8 rounded-2xl border border-[#FDECDC] bg-white p-6 shadow-sm shadow-[#7A3410]/5 sm:p-8 lg:grid-cols-4">
//           {STATS.map((s, i) => (
//             <div
//               key={s.label}
//               className={`px-4 text-center ${i % 2 === 1 ? "border-l border-[#FDECDC]" : ""} ${i > 0 ? "lg:border-l lg:border-[#FDECDC]" : ""}`}
//             >
//               <dd className="text-3xl font-extrabold text-primary-600 sm:text-4xl">
//                 <CountUp to={s.to} decimals={s.decimals} suffix={s.suffix} />
//               </dd>
//               <dt className="mt-1 text-xs text-muted sm:text-sm">{s.label}</dt>
//             </div>
//           ))}
//         </dl>
//       </Reveal>
//     </section>
//   );
// }

import CountUp from "../../../components/motion/CountUp";
import Reveal from "../../../components/motion/Reveal";
import { STATS } from "../data/content";

export default function StatsStrip() {
  return (
    <section className="w-full px-4 pb-4 pt-2 sm:px-6 lg:px-10">
      <Reveal className="mx-auto max-w-7xl">
        <div className="relative overflow-hidden rounded-[1.75rem] border border-[#F3E4D6] bg-white p-6 shadow-[0_18px_50px_-30px_rgba(122,52,16,0.25)] sm:p-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,107,0,0.35),transparent)]"
          />
          <dl className="grid grid-cols-2 gap-y-8 lg:grid-cols-4">
            {STATS.map((s, i) => (
              <div
                key={s.label}
                className={`px-4 text-center ${i % 2 === 1 ? "border-l border-[#F3E4D6]" : ""} ${i > 0 ? "lg:border-l lg:border-[#F3E4D6]" : ""}`}
              >
                <dd className="text-3xl font-extrabold tracking-tight text-primary-600 sm:text-4xl">
                  <CountUp to={s.to} decimals={s.decimals} suffix={s.suffix} />
                </dd>
                <dt className="mt-2 text-xs font-medium text-muted sm:text-sm">
                  {s.label}
                </dt>
              </div>
            ))}
          </dl>
        </div>
      </Reveal>
    </section>
  );
}
