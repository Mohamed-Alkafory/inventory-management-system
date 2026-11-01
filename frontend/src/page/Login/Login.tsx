import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { z } from "zod";
import { ApiError } from "../../api/errors";
import { MOCK_ACCOUNTS } from "../../api/mock/authMock";
import AuthLayout from "../../components/auth/AuthLayout";
import PasswordInput from "../../components/auth/PasswordInput";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import FormField from "../../components/ui/form/FormField";
import { useToast } from "../../components/ui/toast/useToast";
import { useAuth } from "../../context/auth/useAuth";
import { BRAND } from "../../lib/brand";
import { USE_MOCK } from "../../lib/env";

const schema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required").min(8, "Password must be at least 8 characters"),
});

type LoginValues = z.infer<typeof schema>;

function errorText(error: unknown): string | null {
  if (!error) return null;
  return error instanceof ApiError ? error.message : "Something went wrong. Please try again.";
}

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();

  const { control, handleSubmit, setValue } = useForm<LoginValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  // On success the GuestRoute around this page sends the user to where they were going.
  const signIn = useMutation({
    mutationFn: (values: LoginValues) => login(values),
    onSuccess: (user) => toast.success(`Welcome back, ${user.name}`),
  });

  const onSubmit = handleSubmit((values) => signIn.mutate(values));
  const message = errorText(signIn.error);

  const fillDemo = (email: string, password: string) => {
    setValue("email", email, { shouldValidate: true });
    setValue("password", password, { shouldValidate: true });
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle={`Sign in to your ${BRAND} workspace.`}
      footer={
        <>
          New to {BRAND}?{" "}
          <Link to="/register" className="font-semibold text-primary-600 hover:text-primary-700 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      {message && (
        <div
          role="alert"
          className="mb-5 flex items-start gap-2 rounded-control border border-danger-600/30 bg-danger-50 px-3 py-2.5 text-sm text-danger-700 animate-pop-in"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {message}
        </div>
      )}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormField control={control} name="email" label="Email" required>
          {({ field, aria }) => (
            <Input {...field} {...aria} type="email" autoComplete="email" placeholder="you@company.com" />
          )}
        </FormField>

        <FormField control={control} name="password" label="Password" required>
          {({ field, aria }) => (
            <PasswordInput {...field} {...aria} autoComplete="current-password" placeholder="••••••••" />
          )}
        </FormField>

        <Button type="submit" size="lg" fullWidth loading={signIn.isPending}>
          {signIn.isPending ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      {USE_MOCK && (
        <div className="mt-6 rounded-control border border-dashed border-primary-300 bg-primary-50/60 p-3 text-xs text-muted">
          <p className="font-semibold text-primary-700">Mock mode — demo accounts</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {MOCK_ACCOUNTS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => fillDemo(a.email, a.password)}
                className="rounded-full border border-primary-200 bg-white px-3 py-1 font-medium text-primary-700 transition hover:bg-primary-100"
              >
                Fill {a.role.toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      )}
    </AuthLayout>
  );
}
