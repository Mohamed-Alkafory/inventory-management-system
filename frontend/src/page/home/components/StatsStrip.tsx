import CountUp from "../../../components/motion/CountUp";
import Reveal from "../../../components/motion/Reveal";
import { STATS } from "../data/content";

export default function StatsStrip() {
  return (
    <section className="w-full px-4 py-10 sm:px-6 lg:px-10">
      <Reveal className="mx-auto max-w-7xl">
        <dl className="grid grid-cols-2 gap-y-8 rounded-2xl border border-[#FDECDC] bg-white p-6 shadow-sm shadow-[#7A3410]/5 sm:p-8 lg:grid-cols-4">
          {STATS.map((s, i) => (
            <div
              key={s.label}
              className={`px-4 text-center ${i % 2 === 1 ? "border-l border-[#FDECDC]" : ""} ${i > 0 ? "lg:border-l lg:border-[#FDECDC]" : ""}`}
            >
              <dd className="text-3xl font-extrabold text-primary-600 sm:text-4xl">
                <CountUp to={s.to} decimals={s.decimals} suffix={s.suffix} />
              </dd>
              <dt className="mt-1 text-xs text-muted sm:text-sm">{s.label}</dt>
            </div>
          ))}
        </dl>
      </Reveal>
    </section>
  );
}
