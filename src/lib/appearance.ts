import { useEffect, useState, useCallback } from "react";

export type ThemeName = "midnight" | "carbon" | "graphite" | "daylight";
export type AccentName = "red" | "blue" | "amber" | "green" | "violet";
export type Density = "comfortable" | "compact";

export type Appearance = {
  theme: ThemeName;
  accent: AccentName;
  density: Density;
  fontScale: number; // 90 - 115 (%)
  glow: boolean;
};

export const DEFAULT_APPEARANCE: Appearance = {
  theme: "midnight",
  accent: "red",
  density: "comfortable",
  fontScale: 100,
  glow: true,
};

const KEY = "md-appearance";

export const THEMES: { id: ThemeName; label: string; desc: string; swatch: string[] }[] = [
  { id: "midnight", label: "Midnight", desc: "Pure black workshop look (default).", swatch: ["#0a0a0a", "#1c1c1c", "#e5484d"] },
  { id: "carbon", label: "Carbon", desc: "Soft charcoal with cooler surfaces.", swatch: ["#15181c", "#232830", "#e5484d"] },
  { id: "graphite", label: "Graphite", desc: "Lighter dark grey, easier on the eyes.", swatch: ["#1f2124", "#2b2e33", "#e5484d"] },
  { id: "daylight", label: "Daylight", desc: "Light theme for bright workshops.", swatch: ["#f7f7f8", "#ffffff", "#d63b3b"] },
];

export const ACCENTS: { id: AccentName; label: string; color: string }[] = [
  { id: "red", label: "Red", color: "oklch(0.58 0.22 25)" },
  { id: "blue", label: "Blue", color: "oklch(0.55 0.15 255)" },
  { id: "amber", label: "Amber", color: "oklch(0.75 0.16 75)" },
  { id: "green", label: "Green", color: "oklch(0.65 0.16 155)" },
  { id: "violet", label: "Violet", color: "oklch(0.6 0.19 300)" },
];

export function readAppearance(): Appearance {
  if (typeof window === "undefined") return DEFAULT_APPEARANCE;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_APPEARANCE;
    return { ...DEFAULT_APPEARANCE, ...(JSON.parse(raw) as Partial<Appearance>) };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export function applyAppearance(a: Appearance) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.theme = a.theme;
  root.dataset.accent = a.accent;
  root.dataset.density = a.density;
  root.dataset.glow = a.glow ? "on" : "off";
  root.style.fontSize = `${a.fontScale}%`;
  // keep tailwind dark variant on for every dark theme
  root.classList.toggle("dark", a.theme !== "daylight");
}

export function useAppearance() {
  const [appearance, setAppearanceState] = useState<Appearance>(DEFAULT_APPEARANCE);

  useEffect(() => {
    const stored = readAppearance();
    setAppearanceState(stored);
    applyAppearance(stored);
  }, []);

  const setAppearance = useCallback((patch: Partial<Appearance>) => {
    setAppearanceState((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      applyAppearance(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    setAppearanceState(DEFAULT_APPEARANCE);
    applyAppearance(DEFAULT_APPEARANCE);
  }, []);

  return { appearance, setAppearance, reset };
}
