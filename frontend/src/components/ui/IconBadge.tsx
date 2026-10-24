import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type Props = {
  children: ReactNode;
  className?: string;
};

/** Soft orange rounded square that holds an icon. Size it with className (e.g. "h-12 w-12"). */
export default function IconBadge({ children, className }: Props) {
  return (
    <div
      className={cn("flex items-center justify-center rounded-xl bg-[#FDECDC] text-primary-600", className)}
      aria-hidden="true"
    >
      {children}
    </div>
  );
}
