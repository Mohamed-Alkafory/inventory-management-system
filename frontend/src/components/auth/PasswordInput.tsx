import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import Input from "../ui/Input";
import type { InputProps } from "../ui/Input";

/** Password field with a show / hide toggle. Accepts the same props as Input. */
const PasswordInput = forwardRef<HTMLInputElement, Omit<InputProps, "type">>(function PasswordInput(props, ref) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input ref={ref} {...props} type={visible ? "text" : "password"} className="pr-11" />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted transition hover:text-ink focus-visible:outline-2 focus-visible:outline-primary-500"
      >
        {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
      </button>
    </div>
  );
});

export default PasswordInput;
