import Spinner from "./ui/Spinner";

export default function PageLoader() {
  return (
    <div
      className="flex min-h-[40vh] w-full items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <Spinner className="text-[#FF5615]" label="Loading page" />
    </div>
  );
}
