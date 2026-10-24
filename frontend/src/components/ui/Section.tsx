import type { ReactNode } from "react";
import Container from "./Container";

type Props = {
  id?: string;
  title?: string;
  action?: ReactNode;
  alt?: boolean;
  children: ReactNode;
};

export default function Section({ id, title, action, alt = false, children }: Props) {
  return (
    <section
      id={id}
      className={`scroll-mt-20 py-16 ${alt ? "bg-slate-50" : "bg-white"}`}
    >
      <Container>
        {title && (
          <div className="mb-8 flex items-end justify-between gap-4">
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">{title}</h2>
            {action}
          </div>
        )}
        {children}
      </Container>
    </section>
  );
}
