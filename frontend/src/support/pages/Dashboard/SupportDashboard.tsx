import Badge from "../../../components/ui/Badge";
import { Card, CardBody } from "../../../components/ui/Card";
import Container from "../../../components/ui/Container";

/** Placeholder landing page for /support. Real support tools arrive in later tasks. */
export default function SupportDashboard() {
  return (
    <div className="py-4 text-ink">
      <Container className="max-w-none px-0">
        <Badge tone="warning">Coming soon</Badge>
        <h1 className="mt-3 text-3xl font-bold">Support dashboard</h1>
        <p className="mt-2 max-w-2xl text-muted">
          This is the support workspace. Customer conversations and contact messages will appear here in a later
          release.
        </p>

        <Card className="mt-8 max-w-2xl">
          <CardBody>
            <p className="text-sm text-muted">
              Support has no extra tools yet. Customer orders remain private to the customer who placed them.
            </p>
          </CardBody>
        </Card>
      </Container>
    </div>
  );
}
