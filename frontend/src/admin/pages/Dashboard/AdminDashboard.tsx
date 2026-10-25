import { Card, CardBody, CardHeader } from "../../../components/ui/Card";
import Container from "../../../components/ui/Container";

/** ADMIN-only placeholder. Guarded by <RoleRoute allow={["ADMIN"]}> in App.tsx. */
export default function AdminDashboard() {
  return (
    <main className="min-h-[calc(100vh-72px)] bg-surface-alt py-12 text-ink">
      <Container>
        <h1 className="text-3xl font-bold">Admin area</h1>
        <p className="mt-2 text-muted">Only users with the ADMIN role can see this page.</p>

        <Card className="mt-8">
          <CardHeader title="Coming soon" description="Categories, products, inventory, orders, suppliers and users." />
          <CardBody className="text-sm text-muted">Admin pages will be mounted under /admin.</CardBody>
        </Card>
      </Container>
    </main>
  );
}
