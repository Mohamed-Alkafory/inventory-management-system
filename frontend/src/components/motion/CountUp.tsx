import { useCountUp } from "../../hooks/useCountUp";
import { useInView } from "../../hooks/useInView";

type Props = {
  to: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
};

/** A number that counts up the first time it is seen. */
export default function CountUp({ to, decimals = 0, prefix = "", suffix = "", duration, className }: Props) {
  const { ref, inView } = useInView<HTMLSpanElement>({ threshold: 0.4 });
  const value = useCountUp(to, { start: inView, duration });

  return (
    <span ref={ref} className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {prefix}
      {value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}
