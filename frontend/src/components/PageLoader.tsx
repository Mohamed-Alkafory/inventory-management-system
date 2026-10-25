export default function PageLoader() {
  return (
    <div role="status" aria-live="polite" className="flex h-64 items-center justify-center">
      <span className="h-8 w-8 animate-spin rounded-full border-4 border-[#FDEEE8] border-t-[#FF5A26]" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
