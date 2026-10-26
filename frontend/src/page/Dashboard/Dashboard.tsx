import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck } from "lucide-react";
import Badge from "../../components/ui/Badge";
import { Card, CardBody } from "../../components/ui/Card";
import Container from "../../components/ui/Container";
import { buttonClass } from "../../components/ui/buttonClass";
import { useAuth } from "../../context/auth/useAuth";

/** Placeholder for any signed-in user (ADMIN or STAFF). Replace with the real dashboard. */
export default function Dashboard() {
  const { user, role } = useAuth();

  return (
    <div className="min-h-[calc(100vh-72px)] bg-surface-alt py-12 text-ink">
      <Container>
        <h1 className="text-3xl font-bold">Welcome, {user?.name}</h1>
        <p className="mt-2 flex items-center gap-2 text-muted">
          Signed in as {user?.email} <Badge tone={role === "ADMIN" ? "primary" : "info"}>{role}</Badge>
        </p>

        {role === "ADMIN" && (
          <Card className="mt-8">
            <CardBody className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-6 w-6 text-primary-600" aria-hidden="true" />
                <p className="text-sm text-muted">You have admin access to users, suppliers and inventory.</p>
              </div>
              <Link to="/admin" className={buttonClass("primary", "md")}>
                Open admin area <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </CardBody>
          </Card>
        )}
      </Container>
    </div>
  );
}
