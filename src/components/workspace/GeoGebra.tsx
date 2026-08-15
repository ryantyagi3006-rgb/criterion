"use client";
import { useEffect, useId, useRef, useState } from "react";

type GGBApplet = new (params: Record<string, unknown>, html5NoWebSimple: boolean) => {
  inject: (elementId: string) => void;
};

declare global {
  interface Window {
    GGBApplet?: GGBApplet;
  }
}

const LOADER_SRC = "https://www.geogebra.org/apps/deployggb.js";
let loaderPromise: Promise<void> | null = null;

/** Loads GeoGebra's deploy script once per page, however many applets mount. */
function loadGeoGebra(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.GGBApplet) return Promise.resolve();
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = LOADER_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loaderPromise = null;
      reject(new Error("GeoGebra failed to load"));
    };
    document.head.appendChild(script);
  });
  return loaderPromise;
}

/**
 * Embeds a real GeoGebra applet. `appName` picks the app, for example
 * "graphing", "geometry", "classic" or "scientific".
 */
export default function GeoGebra({
  appName = "graphing",
  height = 320,
}: {
  appName?: string;
  height?: number;
}) {
  const hostId = `ggb-${useId().replace(/:/g, "")}`;
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    let cancelled = false;

    loadGeoGebra()
      .then(() => {
        if (cancelled || !hostRef.current || !window.GGBApplet) return;
        // Width is measured rather than fixed, because this sits in a
        // resizable tool panel.
        const width = Math.max(240, Math.floor(hostRef.current.clientWidth));
        const applet = new window.GGBApplet(
          {
            appName,
            width,
            height,
            showToolBar: true,
            showAlgebraInput: true,
            showMenuBar: false,
            showResetIcon: true,
            enableFileFeatures: false,
            allowStyleBar: false,
            useBrowserForJS: false,
            borderColor: "transparent",
            // Lets students open a full-size view, since the panel is narrow.
            showFullscreenButton: true,
          },
          true
        );
        applet.inject(hostId);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("failed");
      });

    return () => {
      cancelled = true;
    };
  }, [appName, height, hostId]);

  if (status === "failed")
    return (
      <p className="text-xs text-soft">
        GeoGebra could not be loaded. Check the connection, then reopen this tool.
      </p>
    );

  return (
    <div>
      <div
        id={hostId}
        ref={hostRef}
        className="w-full overflow-hidden rounded-lg border border-line bg-white"
        style={{ minHeight: height }}
      />
      {status === "loading" ? (
        <p className="text-[10px] text-soft mt-1.5">Loading GeoGebra…</p>
      ) : (
        <p className="text-[10px] text-soft mt-1.5">
          Use the expand icon inside GeoGebra for a full-size view.
        </p>
      )}
    </div>
  );
}
