import { useSearchParams } from "react-router-dom";
import { Bell, KeyRound, UserRound } from "lucide-react";
import { cn } from "../../lib/cn";
import ProfileTab from "./ProfileTab";
import SecurityTab from "./SecurityTab";
import NotificationsTab from "./NotificationsTab";

type Tab = "profile" | "notifications" | "security";

/** Every tab here maps to a backend feature (§3.1 auth, §3.9 preferences). */
const TABS: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
  { id: "profile", label: "Profile", icon: <UserRound className="size-4" aria-hidden="true" /> },
  { id: "notifications", label: "Notifications", icon: <Bell className="size-4" aria-hidden="true" /> },
  { id: "security", label: "Security", icon: <KeyRound className="size-4" aria-hidden="true" /> },
];

const TAB_IDS = TABS.map((t) => t.id);

/**
 * User settings — tabbed account management. The active tab is kept in the
 * `?tab=` query parameter so a refresh (or a shared link) reopens the same tab.
 */
export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get("tab");
  const tab: Tab = TAB_IDS.includes(raw as Tab) ? (raw as Tab) : "profile";

  const setTab = (next: Tab) => setSearchParams({ tab: next }, { replace: true });

  return (
    <div className="min-h-[calc(100vh-128px)] bg-surface-alt py-10 text-ink">
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
        <h1 className="text-2xl font-extrabold sm:text-3xl">Account settings</h1>
        <p className="mt-1 text-sm text-muted">Manage your profile, notifications and security.</p>

        <div role="tablist" aria-label="Settings sections" className="mt-6 flex gap-1 border-b border-line">
          {TABS.map((t) => (
            <button
              key={t.id}
              id={`settings-tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              aria-controls={`settings-panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={cn(
                "-mb-px flex items-center gap-2 rounded-t-control border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                tab === t.id ? "border-primary-600 text-primary-700" : "border-transparent text-muted hover:text-ink",
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        <div id={`settings-panel-${tab}`} role="tabpanel" aria-labelledby={`settings-tab-${tab}`} className="mt-6">
          {tab === "profile" && <ProfileTab />}
          {tab === "notifications" && <NotificationsTab />}
          {tab === "security" && <SecurityTab />}
        </div>
      </div>
    </div>
  );
}
