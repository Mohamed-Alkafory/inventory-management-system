import { Link, useNavigate } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
      <p className="text-7xl font-extrabold text-[#FF5A26]">404</p>
      <h1 className="mt-4 text-2xl font-extrabold text-[#0E2A66]">Page not found</h1>
      <p className="mt-2 text-[#5576AE]">The page you’re looking for doesn’t exist or has been moved.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          to="/dashboard"
          className="rounded-lg bg-[#FF5A26] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#FF5A26]/30 hover:bg-[#EA4A18]"
        >
          Go to dashboard
        </Link>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-lg border border-[#D7EAF8] bg-white px-5 py-2.5 text-sm font-semibold text-[#0E2A66] hover:bg-[#F7FBFE]"
        >
          Go back
        </button>
      </div>
    </div>
  );
}
