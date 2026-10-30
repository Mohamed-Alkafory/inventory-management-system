export default function PagePlaceholder({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <h1 className="text-2xl font-extrabold text-[#0E2A66]">{title}</h1>
      {description && <p className="mt-1 text-sm text-[#5576AE]">{description}</p>}
      <div className="mt-6 rounded-2xl border border-dashed border-[#D7EAF8] bg-white p-10 text-center text-sm text-[#5576AE]">
        {title} page — coming soon.
      </div>
    </div>
  );
}
