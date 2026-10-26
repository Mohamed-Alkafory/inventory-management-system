import type { ReactNode } from "react";
import { useInView } from "../../hooks/useInView";
import { cn } from "../../lib/cn";

type Direction = "up" | "down" | "left" | "right" | "none";

const HIDDEN: Record<Direction, string> = {
  up: "translate-y-8",
  down: "-translate-y-8",
  left: "translate-x-8",
  right: "-translate-x-8",
  none: "",
};

type Props = {
  children: ReactNode;
  /** Milliseconds to wait once visible — use it to stagger siblings. */
  delay?: number;
  /** Where the content slides in from. */
  direction?: Direction;
  className?: string;
};

/** Fades + slides its children in the first time they scroll into view. */
export default function Reveal({ children, delay = 0, direction = "up", className }: Props) {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <div
      ref={ref}
      style={{ transitionDelay: inView ? `${delay}ms` : undefined }}
      className={cn(
        "transition-[opacity,translate] duration-700 ease-out motion-reduce:translate-x-0 motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none",
        inView ? "translate-x-0 translate-y-0 opacity-100" : cn("opacity-0", HIDDEN[direction]),
        className,
      )}
    >
      {children}
    </div>
  );
}
