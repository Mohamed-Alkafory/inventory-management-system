import Badge from "../../../components/ui/Badge";
import { Card, CardBody } from "../../../components/ui/Card";
import Container from "../../../components/ui/Container";

/** Placeholder landing page for /staff. Real tools arrive in later tasks. */
export default function StaffDashboard() {
  return (
    <div className="py-4 text-ink">
      <Container className="max-w-none px-0">
        <Badge tone="info">Coming soon</Badge>
        <h1 className="mt-3 text-3xl font-bold">Staff dashboard</h1>
        <p className="mt-2 max-w-2xl text-muted">
          This is the staff workspace. Order building and product tools will live here; for now use the shortcuts in the
          sidebar.
        </p>

        <Card className="mt-8 max-w-2xl">
          <CardBody>
            <p className="text-sm text-muted">
              Staff tools are read-only for now. Stock, purchase orders and user management stay in the admin area.
            </p>
          </CardBody>
        </Card>
      </Container>
    </div>
  );
}
