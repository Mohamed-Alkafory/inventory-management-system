import NotificationPreferences from "./NotificationPreferences";
import NotificationsList from "./NotificationsList";

/** Signed-in notification centre for every role. */
export default function NotificationsPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <NotificationsList />
      <NotificationPreferences />
    </main>
  );
}
