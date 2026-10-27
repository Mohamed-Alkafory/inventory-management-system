import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface MenuAction {
  label: string;
  onSelect: () => void;
  icon?: LucideIcon;
  danger?: boolean;
}

/** The "⋮" button at the end of a table row. `label` names it for screen readers. */
export default function RowActionsMenu({ label, actions }: { label: string; actions: MenuAction[] }) {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const open = pos !== null;
  const close = () => setPos(null);

  const toggle = () => {
    if (open) return close();
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
  };

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();

    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !btnRef.current?.contains(t)) setPos(null);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setPos(null);
        btnRef.current?.focus();
      }
    };
    const onMove = () => setPos(null); // keep it simple: close on scroll / resize
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open]);

  // Arrow keys move between items.
  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next = e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    items[next]?.focus();
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-md p-2 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5615]"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={label}
            onKeyDown={onMenuKey}
            style={{ position: "fixed", top: pos.top, right: pos.right }}
            className="z-50 min-w-40 rounded-xl border border-[#E5E7EB] bg-white p-1.5 shadow-lg shadow-black/10"
          >
            {actions.map((a) => {
              const Icon = a.icon;
              return (
                <button
                  key={a.label}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    close();
                    a.onSelect();
                  }}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium focus:outline-none ${
                    a.danger
                      ? "text-[#DC2626] hover:bg-[#FEF2F2] focus:bg-[#FEF2F2]"
                      : "text-[#111827] hover:bg-[#FFF1EB] focus:bg-[#FFF1EB]"
                  }`}
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  {a.label}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
