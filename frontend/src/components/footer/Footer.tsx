import Container from "../ui/Container";

const COLUMNS = [
  {
    title: "Marketplace",
    links: [
      { label: "Products", href: "/products" },
      { label: "Stores", href: "#" },
      { label: "Categories", href: "/products" },
    ],
  },
  {
    title: "Sellers",
    links: [
      { label: "Open a store", href: "#" },
      { label: "Seller guide", href: "#" },
      { label: "Pricing", href: "#" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Support", href: "#" },
      { label: "Privacy", href: "#" },
    ],
  },
];

export default function Footer() {
  return (
    <footer id="contact" className="mt-16 scroll-mt-20 bg-slate-900 text-slate-300">
      <Container className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <strong className="text-xl text-white">Prodexa</strong>
          <p className="mt-3 text-sm">
            The marketplace where every seller gets their own store.
          </p>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h4 className="mb-3 font-semibold text-white">{col.title}</h4>
            <ul className="space-y-2 text-sm">
              {col.links.map((l) => (
                <li key={l.label}>
                  <a href={l.href} className="transition hover:text-white">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Container>

      <div className="border-t border-slate-800 py-5 text-center text-sm text-slate-400">
        © {new Date().getFullYear()} Prodexa. All rights reserved.
      </div>
    </footer>
  );
}
