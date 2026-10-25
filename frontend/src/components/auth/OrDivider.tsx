export default function OrDivider() {
  return (
    <div className="my-5 flex items-center gap-3 text-xs font-medium uppercase tracking-wider text-muted" role="separator">
      <span className="h-px flex-1 bg-line" />
      or
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
