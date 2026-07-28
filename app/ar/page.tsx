"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

// MindAR needs the camera + WebGL, so this must only ever run in the browser.
const ARScene = dynamic(() => import("@/components/ARScene"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-black text-sm text-neutral-400">
      Loading AR…
    </div>
  ),
});

function ARView() {
  const searchParams = useSearchParams();
  const calibrate = searchParams.get("calibrate") === "true";
  const initialVariant = searchParams.get("variant") === "b" ? "b" : "a";
  return <ARScene calibrate={calibrate} initialVariant={initialVariant} />;
}

export default function ARPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 flex items-center justify-center bg-black text-sm text-neutral-400">
          Loading AR…
        </div>
      }
    >
      <ARView />
    </Suspense>
  );
}
