import { formatRange, type ValveSpec } from "@/lib/valve-specs";

export type ValveSheetArgs = {
  cylinders: number;
  bike?: { make?: string | null; model?: string | null; year?: number | null; rego?: string | null };
  values?: Record<string, string | number | null | undefined>;
  spec: ValveSpec;
  /** When false the exhaust valves are drawn on top. */
  intakeOnTop?: boolean;
  /** Circle diameter in px — lets the user pick how big the diagram prints. */
  circle?: number;
  layout?: "inline" | "v4" | "v2";
  order?: number[];
  frontDeg?: number;
  intakeInMiddle?: boolean;
};

/** Upper bank faces down into the valley; lower bank faces up into it. */
export function valveIntakeOnTop(index: number, isV: boolean, intakeInMiddle: boolean, intakeOnTop: boolean, bankWidth = 2) {
  return isV && intakeInMiddle ? index >= bankWidth : intakeOnTop;
}

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

/**
 * Standalone HTML for the valve-clearance worksheet, independent from the job
 * card DOM so the technician can print it for any cylinder count.
 */
export function valveSheetHtml({ cylinders, bike, values, spec, intakeOnTop = true, circle = 92, layout = "inline", order, frontDeg = 0, intakeInMiddle = false }: ValveSheetArgs) {
  const n = Math.max(1, Math.min(6, cylinders));
  const isV4 = layout === "v4" && n === 4;
  const isV2 = layout === "v2" && n === 2;
  const isV = isV4 || isV2;
  const cylinderOrder = Array.from(new Set((order ?? []).filter((c) => Number.isInteger(c) && c >= 1 && c <= n)));
  for (let c = 1; c <= n; c++) if (!cylinderOrder.includes(c)) cylinderOrder.push(c);
  const frontLabel = ["FRONT ↑", "FRONT →", "FRONT ↓", "FRONT ←"][Math.round(((frontDeg % 360) + 360) % 360 / 90) % 4];
  const cyls = cylinderOrder
    .map((cyl, index) => {
      const intakeTop = valveIntakeOnTop(index, isV, intakeInMiddle, intakeOnTop, n / 2);
      const circles = (kind: "intake" | "exhaust") =>
        Array.from({ length: 2 })
          .map((_, i) => {
            const v = values?.[`c${cyl}_${kind}_${i}`] ?? "";
            return `<div style="height:${circle}px;width:${circle}px;border-radius:9999px;border:${
              kind === "exhaust" ? "3px solid #111" : "3px solid #444"
            };display:flex;align-items:center;justify-content:center;font-family:ui-monospace,monospace;font-size:${Math.round(
              circle / 4.5,
            )}px;font-weight:700;background:#fff;">${esc(v)}</div>`;
          })
          .join("");
      return `<div style="border:1px solid #9ca3af;border-radius:16px;padding:14px;display:flex;flex-direction:column;align-items:center;gap:10px;flex:1;max-width:${
        circle * 2.6
      }px;">
        <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;font-weight:700;color:#374151;">Cyl ${cyl}</div>
        <div data-valve-side="${intakeTop ? "intake" : "exhaust"}" style="display:flex;gap:10px;">${circles(intakeTop ? "intake" : "exhaust")}</div>
        <div style="height:12px;width:12px;border-radius:9999px;border:1px solid #6b7280;background:#e5e7eb;"></div>
        <div data-valve-side="${intakeTop ? "exhaust" : "intake"}" style="display:flex;gap:10px;">${circles(intakeTop ? "exhaust" : "intake")}</div>
      </div>`;
    })
    .join("");

  return `<div class="valve-worksheet" style="font-family:inherit;color:#111;">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:2px solid #111;padding-bottom:6px;margin-bottom:14px;">
      <div>
        <div style="font-size:10px;letter-spacing:.25em;text-transform:uppercase;color:#4b5563;">Valve Clearance Worksheet</div>
        <div style="font-size:20px;font-weight:800;line-height:1.15;">${esc(bike?.make)} ${esc(
          bike?.model,
        )} ${esc(bike?.year ?? "")} · ${n}-cyl · Rego ${esc(bike?.rego ?? "—")}</div>
      </div>
      <div style="text-align:right;font-size:12px;">
        <b>Spec (cold)</b> · I <span style="font-family:ui-monospace,monospace;">${formatRange(
          spec.intake,
        )}</span> · E <span style="font-family:ui-monospace,monospace;">${formatRange(spec.exhaust)}</span>
        <div style="font-size:9px;color:#6b7280;">${spec.generic ? "Generic — verify manual · " : ""}${esc(
          spec.source,
        )}</div>
      </div>
    </div>
    ${spec.note ? `<div style="font-size:11px;color:#374151;margin-bottom:8px;"><b>Note:</b> ${esc(spec.note)}</div>` : ""}
    <div style="font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#4b5563;text-align:center;margin-bottom:10px;">
      Top-down · ${isV && intakeInMiddle ? "INTAKE inside / EXHAUST outside" : intakeOnTop ? "INTAKE top / EXHAUST bottom" : "EXHAUST top / INTAKE bottom"} · ${frontLabel} · write measured mm inside each circle
    </div>
    <div data-valve-layout="${isV ? layout : "inline"}" style="display:${isV ? `grid;grid-template-columns:repeat(${n / 2},max-content);width:max-content;margin-left:auto;margin-right:auto` : "flex"};gap:16px;justify-content:center;align-items:stretch;margin-bottom:12px;">${cyls}</div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:11px;color:#374151;margin-top:14px;padding-top:6px;border-top:1px solid #d1d5db;">
      <span>New shim = Current + (Measured − Target). Target = mid-spec.</span>
      <span>Technician: ______________ Date: ___ / ___ / ______</span>
    </div>
  </div>`;
}
