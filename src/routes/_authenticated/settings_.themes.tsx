import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Palette, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useAppearance, THEMES, ACCENTS } from "@/lib/appearance";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/settings_/themes")({
  head: () => ({
    meta: [
      { title: "Themes & Appearance — Motorcycle Doctors" },
      { name: "description", content: "Choose your theme, accent colour, density and text size." },
      { property: "og:title", content: "Themes & Appearance — Motorcycle Doctors" },
      { property: "og:description", content: "Personalise how the workshop app looks for your account." },
    ],
  }),
  component: ThemesPage,
});

function ThemesPage() {
  const { appearance, setAppearance, reset } = useAppearance();

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-16">
      <header className="flex items-start justify-between gap-3">
        <div>
          <Link
            to="/settings"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Settings
          </Link>
          <h1 className="font-display text-3xl font-bold mt-1 flex items-center gap-2">
            <Palette className="h-6 w-6 text-primary" /> Themes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Appearance settings are saved on this device for your user.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={reset}>
          <RotateCcw className="h-4 w-4 mr-1.5" /> Reset
        </Button>
      </header>

      <section className="card-surface p-5 space-y-4">
        <div>
          <h2 className="font-display text-lg font-bold">Theme</h2>
          <p className="text-sm text-muted-foreground">Base colours and surfaces.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {THEMES.map((t) => {
            const active = appearance.theme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setAppearance({ theme: t.id })}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                  active ? "border-primary bg-primary/10" : "border-border hover:border-primary/50",
                )}
              >
                <span className="flex h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border">
                  {t.swatch.map((c) => (
                    <span key={c} className="flex-1" style={{ background: c }} />
                  ))}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-semibold">
                    {t.label}
                    {active && <Check className="h-4 w-4 text-primary" />}
                  </span>
                  <span className="block text-xs text-muted-foreground">{t.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="card-surface p-5 space-y-4">
        <div>
          <h2 className="font-display text-lg font-bold">Accent colour</h2>
          <p className="text-sm text-muted-foreground">Used for buttons, links and highlights.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {ACCENTS.map((a) => {
            const active = appearance.accent === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setAppearance({ accent: a.id })}
                title={a.label}
                className={cn(
                  "grid h-11 w-11 place-items-center rounded-full border-2 transition-transform hover:scale-105",
                  active ? "border-foreground" : "border-transparent",
                )}
                style={{ background: a.color }}
              >
                {active && <Check className="h-5 w-5 text-white drop-shadow" />}
              </button>
            );
          })}
        </div>
      </section>

      <section className="card-surface p-5 space-y-5">
        <div>
          <h2 className="font-display text-lg font-bold">Layout & text</h2>
          <p className="text-sm text-muted-foreground">Fine tune spacing and readability.</p>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="text-sm font-medium">Compact mode</Label>
            <p className="text-xs text-muted-foreground">Tighter corners and spacing.</p>
          </div>
          <Switch
            checked={appearance.density === "compact"}
            onCheckedChange={(v) => setAppearance({ density: v ? "compact" : "comfortable" })}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="text-sm font-medium">Background glow</Label>
            <p className="text-xs text-muted-foreground">Subtle coloured gradients behind the app.</p>
          </div>
          <Switch
            checked={appearance.glow}
            onCheckedChange={(v) => setAppearance({ glow: v })}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Text size</Label>
            <span className="text-xs text-muted-foreground">{appearance.fontScale}%</span>
          </div>
          <Slider
            min={90}
            max={115}
            step={5}
            value={[appearance.fontScale]}
            onValueChange={([v]) => setAppearance({ fontScale: v })}
          />
        </div>
      </section>

      <section className="card-surface p-5 space-y-3">
        <h2 className="font-display text-lg font-bold">Preview</h2>
        <div className="rounded-xl border border-border bg-background p-4 space-y-3">
          <div className="font-display text-xl font-bold">Booking #1042</div>
          <p className="text-sm text-muted-foreground">Yamaha MT-09 — Annual service</p>
          <div className="flex gap-2">
            <Button size="sm">Primary</Button>
            <Button size="sm" variant="outline">
              Outline
            </Button>
            <Button size="sm" variant="secondary">
              Secondary
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
