import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Orientation arrow ("FRONT" of the bike) for the valve clearance diagram.
 * - Click rotates 90°.
 * - Drag with the mouse to rotate; snaps to the nearest 90° on release.
 */
export function FrontArrow({
  deg,
  onChange,
  disabled = false,
  size = 96,
}: {
  deg: number;
  onChange: (deg: number) => void;
  disabled?: boolean;
  size?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const dragging = drag !== null;

  const angleFrom = useCallback((clientX: number, clientY: number) => {
    const el = ref.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    // 0deg = arrow pointing up
    const a = (Math.atan2(clientX - cx, cy - clientY) * 180) / Math.PI;
    return (a + 360) % 360;
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => {
      const a = angleFrom(e.clientX, e.clientY);
      if (a !== null) setDrag(a);
    };
    const up = (e: PointerEvent) => {
      const a = angleFrom(e.clientX, e.clientY) ?? drag ?? 0;
      const snapped = (Math.round(a / 90) * 90) % 360;
      setDrag(null);
      onChange(snapped);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [dragging, drag, angleFrom, onChange]);

  const shown = drag ?? deg;
  const label = ["Front ↑", "Front →", "Front ↓", "Front ←"][Math.round((deg % 360) / 90) % 4];

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <div
        ref={ref}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Rotate front orientation"
        title="Click or drag to rotate — snaps to 90°"
        onPointerDown={(e) => {
          if (disabled) return;
          e.preventDefault();
          const a = angleFrom(e.clientX, e.clientY);
          setDrag(a ?? deg);
        }}
        onClick={() => {
          if (disabled || dragging) return;
          onChange((Math.round(deg / 90) * 90 + 90) % 360);
        }}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "ArrowRight" || e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onChange((Math.round(deg / 90) * 90 + 90) % 360);
          }
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            onChange((Math.round(deg / 90) * 90 + 270) % 360);
          }
        }}
        style={{ width: size, height: size, touchAction: "none" }}
        className={`relative grid place-items-center rounded-full border-2 border-primary/50 bg-primary/5 ${
          disabled ? "opacity-60" : "cursor-grab active:cursor-grabbing hover:border-primary"
        }`}
      >
        <svg
          viewBox="0 0 100 100"
          width={size - 10}
          height={size - 10}
          style={{
            transform: `rotate(${shown}deg)`,
            transition: dragging ? "none" : "transform 150ms ease-out",
          }}
        >
          <line
            x1="50"
            y1="80"
            x2="50"
            y2="24"
            stroke="currentColor"
            strokeWidth="7"
            strokeLinecap="round"
            className="text-primary"
          />
          <polygon points="50,10 66,34 34,34" fill="currentColor" className="text-primary" />
        </svg>
      </div>
      <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground font-bold">
        {label}
      </div>
    </div>
  );
}
