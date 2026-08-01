"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StartButton({ assessmentId, resuming }: { assessmentId: string; resuming: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const res = await fetch(`/api/assessments/${assessmentId}/start`, { method: "POST" });
        const data = await res.json();
        if (res.ok) router.push(`/attempt/${data.id}`);
        else setBusy(false);
      }}
      className="shrink-0 rounded-lg bg-teal hover:bg-tealdeep disabled:opacity-50 text-paper text-sm font-semibold px-4 py-2.5 transition-colors"
    >
      {busy ? "Opening" : resuming ? "Resume" : "Start"}
    </button>
  );
}
