import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import Reveal from "../../../components/motion/Reveal";
import SectionHeading from "../../../components/ui/SectionHeading";
import { BRAND } from "../../../lib/brand";
import { FAQS } from "../data/content";

export default function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);
  const baseId = useId();

  return (
    <section id="faq" className="w-full scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20 lg:px-10">
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <SectionHeading
            eyebrow="FAQ"
            title="Questions? We Have Answers"
            text={`Quick answers about how ${BRAND} works day to day.`}
          />
        </Reveal>

        <ul className="space-y-3">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            const panelId = `${baseId}-panel-${i}`;
            return (
              <li key={f.q}>
                <Reveal delay={i * 90}>
                  <div
                    className={`rounded-2xl border bg-white shadow-sm shadow-[#7A3410]/5 transition-colors duration-300 motion-reduce:transition-none ${
                      isOpen ? "border-primary-200" : "border-[#FDECDC] hover:border-primary-200"
                    }`}
                  >
                    <h3>
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        onClick={() => setOpen(isOpen ? null : i)}
                        className="flex w-full items-center justify-between gap-4 rounded-2xl px-5 py-4 text-left text-sm font-semibold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
                      >
                        {f.q}
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 text-primary-600 transition-transform duration-300 motion-reduce:transition-none ${isOpen ? "rotate-180" : ""}`}
                          aria-hidden="true"
                        />
                      </button>
                    </h3>

                    {/* grid-rows 0fr → 1fr animates height without measuring it */}
                    <div
                      className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
                        isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                      }`}
                    >
                      <div
                        className={`overflow-hidden transition-[visibility] duration-300 ${isOpen ? "visible" : "invisible"}`}
                      >
                        <p id={panelId} className="px-5 pb-5 text-sm leading-relaxed text-muted">
                          {f.a}
                        </p>
                      </div>
                    </div>
                  </div>
                </Reveal>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
