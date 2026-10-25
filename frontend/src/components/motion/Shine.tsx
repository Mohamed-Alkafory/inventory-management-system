/**
 * Light sweep that runs across a button on hover.
 * The parent needs the classes: "group relative overflow-hidden".
 */
export default function Shine() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 left-0 w-1/4 -translate-x-full bg-white/30 group-hover:animate-shine motion-reduce:hidden"
    />
  );
}
