import { useContext } from "react";
import { ToastContext } from "./toast-context";

/** const toast = useToast(); toast.success("Product saved"); */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
