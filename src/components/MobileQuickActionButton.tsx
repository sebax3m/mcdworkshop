import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function MobileQuickActionButton({ isAdmin }: { isAdmin: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 60);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!isAdmin) return null;

  return (
    <Link
      to="/bookings/new"
      className={cn(
        "fixed left-4 z-50 sm:hidden transition-all duration-300 ease-out",
        visible
          ? "translate-y-0 opacity-100 pointer-events-auto"
          : "-translate-y-2 opacity-0 pointer-events-none"
      )}
      style={{ top: "76px" }}
    >
      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-lg hover:scale-[1.02] active:scale-95 transition-transform">
        <Plus className="h-4 w-4" />
        Book In
      </span>
    </Link>
  );
}
