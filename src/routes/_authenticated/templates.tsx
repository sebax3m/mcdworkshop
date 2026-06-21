import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/templates")({
  component: Templates,
});

function Templates() {
  const { data: templates = [] } = useQuery({
    queryKey: ["templates-page"],
    queryFn: async () => (await supabase.from("service_templates").select("*").order("sort_order")).data ?? [],
  });

  return (
    <div className="space-y-5">
      <header>
        <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Workshop</div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold">Service Templates</h1>
        <p className="text-sm text-muted-foreground mt-1">Predefined checklists that drop into a new job in one tap.</p>
      </header>

      <div className="grid sm:grid-cols-2 gap-3">
        {templates.map((t: any) => (
          <div key={t.id} className="card-surface p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-primary">{t.estimated_hours}h est.</div>
                <div className="font-display text-xl font-bold mt-0.5">{t.name}</div>
              </div>
              <span className="grid h-8 w-8 place-items-center rounded-full bg-muted text-xs font-semibold">
                {Array.isArray(t.tasks) ? t.tasks.length : 0}
              </span>
            </div>
            {t.description && <p className="text-sm text-muted-foreground mt-2">{t.description}</p>}
            <ul className="mt-3 space-y-1.5">
              {(Array.isArray(t.tasks) ? t.tasks : []).map((task: any, i: number) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <span className="grid h-5 w-5 place-items-center rounded-md border border-border text-primary">
                    <Check className="h-3 w-3" />
                  </span>
                  {task.label}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}