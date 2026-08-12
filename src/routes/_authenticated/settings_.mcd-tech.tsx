import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { DEFAULT_SETTINGS, useMcdTechSettings, type McdTechSettings } from "@/lib/mcd-tech-settings";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/settings_/mcd-tech")({
  head: () => ({
    meta: [
      { title: "MCD TECH Settings — Motorcycle Doctors" },
      { name: "description", content: "Control the workshop AI assistant, external AI fallback and technician access." },
      { property: "og:title", content: "MCD TECH Settings — Motorcycle Doctors" },
      { property: "og:description", content: "Workshop-wide controls for the MCD TECH AI assistant." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: McdTechSettingsPage,
});

const TOGGLES: { key: keyof McdTechSettings; title: string; desc: string }[] = [
  {
    key: "ai_enabled",
    title: "Enable MCD TECH",
    desc: "Master switch for the workshop assistant across the whole app.",
  },
  {
    key: "allow_technician_access",
    title: "Technician access",
    desc: "Let technicians open MCD TECH from job cards, bikes and the library.",
  },
  {
    key: "external_ai_enabled",
    title: "External AI fallback",
    desc: "When nothing internal matches, allow an external AI answer — always labelled UNVERIFIED.",
  },
  {
    key: "allow_customer_reports",
    title: "Customer explanations",
    desc: "Allow generating plain-language explanations of findings for customers.",
  },
  {
    key: "allow_library_proposals",
    title: "Library proposals",
    desc: "Allow suggesting verified answers as additions to the Garage Library.",
  },
];

function McdTechSettingsPage() {
  const { isAdmin } = useCurrentUser();
  const { data } = useMcdTechSettings();
  const qc = useQueryClient();
  const [values, setValues] = useState<McdTechSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (data) setValues(data);
  }, [data]);

  async function update(key: keyof McdTechSettings, value: boolean) {
    setValues((v) => ({ ...v, [key]: value }));
    setSaving(key);
    const patch = { [key]: value } as Partial<McdTechSettings>;
    const { data: row } = await supabase.from("mcd_tech_settings").select("id").maybeSingle();
    const { error } = row
      ? await supabase.from("mcd_tech_settings").update(patch as never).eq("id", (row as any).id)
      : await supabase.from("mcd_tech_settings").insert({ ...values, ...patch } as never);
    setSaving(null);
    if (error) {
      toast.error(error.message);
      setValues((v) => ({ ...v, [key]: !value }));
      return;
    }
    void qc.invalidateQueries({ queryKey: ["mcd-tech-settings"] });
  }

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto card-surface p-6">
        <p className="text-sm text-muted-foreground">Only admins can change MCD TECH settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-16">
      <header>
        <Link
          to="/settings"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Settings
        </Link>
        <h1 className="font-display text-3xl font-bold mt-1 flex items-center gap-2">
          <Wrench className="h-6 w-6 text-amber-400" /> MCD TECH
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Workshop knowledge is always searched first. These controls decide who can use the assistant and
          whether external AI may be used at all.
        </p>
      </header>

      <section className="card-surface divide-y divide-border">
        {TOGGLES.map((t) => (
          <div key={t.key} className="flex items-start justify-between gap-4 p-5">
            <div className="min-w-0">
              <div className="font-display font-bold flex items-center gap-2">
                {t.title}
                {saving === t.key && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{t.desc}</p>
            </div>
            <Switch
              checked={values[t.key]}
              disabled={t.key !== "ai_enabled" && !values.ai_enabled}
              onCheckedChange={(v) => void update(t.key, v)}
            />
          </div>
        ))}
      </section>

      <section className="card-surface p-5 space-y-2">
        <h2 className="font-display text-lg font-bold">Answer rules</h2>
        <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
          <li>Manufacturer / library data is used before anything else.</li>
          <li>Workshop history is used next and labelled as workshop verified.</li>
          <li>Safety-critical topics (torque, valves, fluids) never guess between generations.</li>
          <li>External AI answers are always labelled UNVERIFIED and are never saved as workshop data.</li>
        </ul>
        <Button asChild variant="outline" size="sm" className="mt-2">
          <Link to="/garage-library">Open Garage Library</Link>
        </Button>
      </section>
    </div>
  );
}
