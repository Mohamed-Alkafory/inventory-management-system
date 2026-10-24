import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type Props = {
  eyebrow: string;
  title: ReactNode;
  text?: string;
  className?: string;
};

/** Centered section intro: ——  EYEBROW  ——, big title, muted paragraph. */
export default function SectionHeading({ eyebrow, title, text, className }: Props) {
  return (
    <div className={cn("mx-auto mb-10 max-w-2xl text-center", className)}>
      <div className="mb-3 flex items-center justify-center gap-3">
        <span className="h-0.5 w-8 bg-primary-500" aria-hidden="true" />
        <span className="text-xs font-semibold uppercase tracking-widest text-primary-600">{eyebrow}</span>
        <span className="h-0.5 w-8 bg-primary-500" aria-hidden="true" />
      </div>
      <h2 className="text-3xl font-bold leading-tight text-ink sm:text-4xl">{title}</h2>
      {text && <p className="mt-4 leading-relaxed text-muted">{text}</p>}
    </div>
  );
}
