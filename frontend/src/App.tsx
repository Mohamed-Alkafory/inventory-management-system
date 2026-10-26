import { RouterProvider } from "react-router-dom";
import { router } from "./app/routes";
import ToastProvider from "./components/ui/toast/ToastProvider";
import AuthProvider from "./context/auth/AuthProvider";
import QueryProvider from "./providers/QueryProvider";

export default function App() {
  return (
    <QueryProvider>
      <ToastProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ToastProvider>
    </QueryProvider>
  );
}
