import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, LogOut } from "lucide-react";
import { LOGIN_PATH } from "../../config";
import { useAuth } from "../../auth/useAuth";

export default function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;

  const handleLogout = () => {
    setOpen(false);
    logout();
    navigate(LOGIN_PATH, { replace: true });
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition hover:bg-[#F4F9FE] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A26]"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FF5A26] text-sm font-bold text-white">
          {user.name.charAt(0).toUpperCase()}
        </span>
        <span className="hidden text-sm font-semibold text-[#0E2A66] sm:block">{user.name}</span>
        <ChevronDown className="h-4 w-4 text-[#5576AE]" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-60 rounded-xl border border-[#E3EDF9] bg-white p-2 shadow-lg shadow-[#0E2A66]/10"
        >
          <div className="px-3 py-2">
            <p className="text-sm font-semibold text-[#0E2A66]">{user.name}</p>
            <p className="truncate text-xs text-[#5576AE]">{user.email}</p>
            <span className="mt-1.5 inline-block rounded-full bg-[#FDEEE8] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#FF5A26]">
              {user.role}
            </span>
          </div>
          <div className="my-1 h-px bg-[#E3EDF9]" />
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[#0E2A66] hover:bg-[#F4F9FE] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A26]"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
