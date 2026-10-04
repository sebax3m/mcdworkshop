import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { ActivityLogView } from "@/components/ActivityLogView";

export const Route = createFileRoute("/_authenticated/settings_/activity")({
  head: () => ({
    meta: [
      { title: "Activity & Deleted Items — MCD Workshop" },
      { name: "description", content: "30-day history of changes and deleted records, with restore." },
      { property: "og:title", content: "Activity & Deleted Items — MCD Workshop" },
      { property: "og:description", content: "30-day history of changes and deleted records, with restore." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ActivityPage,
});

function ActivityPage() {
  const { isAdmin, loading } = useCurrentUser();
  const [tab, setTab] = useState<"deleted" | "all">("deleted");
  if (loading) return null;
  if (!isAdmin)
    return <div className="p-8 text-center text-muted-foreground">Only administrators can view this page.</div>;
  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <Link to="/settings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Settings
      </Link>
      <header>
        <h1 className="font-display text-3xl font-bold">Activity & Deleted Items</h1>
        <p className="text-sm text-muted-foreground mt-1">Last 30 days. Anything deleted can be restored from here.</p>
      </header>
      <div className="flex gap-2">
        {(["deleted", "all"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === t ? "bg-primary text-primary-foreground" : "bg-muted"}`}
          >
            {t === "deleted" ? "Deleted items" : "All activity"}
          </button>
        ))}
      </div>
      <ActivityLogView key={tab} onlyDeleted={tab === "deleted"} />
    </div>
  );
}
