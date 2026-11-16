import { useEffect, useState } from "react";
import { isForeground } from "@/lib/polling-policy";

/** Pause server reads in hidden tabs and unfocused windows; resume on return. */
export function useForeground() {
  const [foreground, setForeground] = useState(false);
  useEffect(() => {
    const update = () => setForeground(isForeground(!document.hidden, document.hasFocus()));
    update();
    document.addEventListener("visibilitychange", update);
    window.addEventListener("focus", update);
    window.addEventListener("blur", update);
    return () => {
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("focus", update);
      window.removeEventListener("blur", update);
    };
  }, []);
  return foreground;
}