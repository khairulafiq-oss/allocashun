import { useEffect } from "react";
import { useStore } from "../state/StoreContext";

export function FlashBanner() {
  const { flash, setFlash } = useStore();

  useEffect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => setFlash(null), 3200);
    return () => window.clearTimeout(id);
  }, [flash, setFlash]);

  if (!flash) return null;
  return (
    <div className={`flash ${flash.kind === "ok" ? "flash-ok" : "flash-bad"}`}>
      {flash.message}
    </div>
  );
}
