import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { buttonClass } from "../../components/ui/buttonClass";
import { useAuth } from "../../context/auth/useAuth";
import { homePathForRole } from "../../routes/redirect";

export default function Forbidden() {
  const { isAuthenticated, role } = useAuth();
  const home = isAuthenticated ? homePathForRole(role) : "/";

  return (
    <main className="flex min-h-[calc(100vh_-_var(--header-h))] items-center justify-center bg-[#FDFDFC] px-4 text-center text-ink">
      <div className="max-w-md">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-danger-50 text-danger-600">
          <ShieldAlert className="h-8 w-8" aria-hidden="true" />
        </div>
        <p className="mt-6 text-sm font-semibold uppercase tracking-widest text-danger-600">Error 403</p>
        <h1 className="mt-2 text-3xl font-bold">You don’t have access to this page</h1>
        <p className="mt-3 text-muted">
          Your account doesn’t have the role required to view this area. If you think this is a mistake, contact an
          administrator.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to={home} className={buttonClass("primary", "md")}>
            {isAuthenticated ? "Back to your area" : "Back to home"}
          </Link>
        </div>
      </div>
    </main>
  );
}
