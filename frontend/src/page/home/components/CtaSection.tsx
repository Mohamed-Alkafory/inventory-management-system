import { Link } from "react-router-dom";
import { History, ShieldCheck, Zap } from "lucide-react";
import Reveal from "../../../components/motion/Reveal";
import Shine from "../../../components/motion/Shine";
import { buttonClass } from "../../../components/ui/buttonClass";
import { BRAND } from "../../../lib/brand";

export default function CtaSection() {
  return (
    <section className="w-full px-4 pb-16 pt-4 sm:px-6 sm:pb-24 lg:px-10">
      <Reveal className="mx-auto max-w-7xl">
        <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-[#DDE5F2] via-[#E4E9F6] to-[#F6DDD6] bg-size-[200%_200%] px-6 py-14 text-center animate-gradient motion-reduce:animate-none sm:py-20">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 left-2/3 h-64 w-96 -translate-x-1/2 animate-blob rounded-full bg-[#F4B9B0]/50 blur-3xl motion-reduce:animate-none"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-28 left-10 h-64 w-80 animate-blob rounded-full bg-[#FDBA8C]/30 blur-3xl motion-reduce:animate-none"
            style={{ animationDelay: "-8s" }}
          />

          <div className="relative mx-auto max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#C2461F]">Take Control Today</p>
            <h2 className="mt-3 text-3xl font-bold leading-tight text-[#14172B] sm:text-4xl">
              Ready to Bring Your Inventory Under Control?
            </h2>
            <p className="mx-auto mt-4 max-w-xl leading-relaxed text-[#5B5E72]">
              Join retailers who replaced manual spreadsheets and guesswork with {BRAND}.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/contact"
                className={buttonClass(
                  "primary",
                  "lg",
                  "group relative w-full overflow-hidden shadow-md shadow-primary-500/30 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary-500/40 sm:w-auto",
                  true,
                )}
              >
                <Shine />
                Request a Demo
              </Link>
              <Link
                to="/about"
                className={buttonClass("white", "lg", "w-full text-[#14172B] shadow-sm hover:-translate-y-0.5 sm:w-auto", true)}
              >
                Learn More About Us
              </Link>
            </div>

            <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-[#4A4D60]">
              <li className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-[#1F8F6B]" aria-hidden="true" /> Role-based access
              </li>
              <li className="flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-[#1F8F6B]" aria-hidden="true" /> 5-minute guided setup
              </li>
              <li className="flex items-center gap-1.5">
                <History className="h-4 w-4 text-[#1F8F6B]" aria-hidden="true" /> Full stock history
              </li>
            </ul>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
