"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteCycleButton({
  cycleId,
  cycleName,
  submissionCount,
}: {
  cycleId: string;
  cycleName: string;
  submissionCount: number;
}) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function onDelete() {
    const subWarn =
      submissionCount > 0
        ? `\n\nThis cycle has ${submissionCount} submission(s). They will be deleted too, including any scoring and admin decisions. Participants themselves are NOT deleted — delete them separately if you want them gone.`
        : "";
    if (!confirm(`Delete cycle "${cycleName}"?${subWarn}\n\nCannot be undone.`)) {
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/admin/cycles/${cycleId}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Delete failed — check server logs.");
      setBusy(false);
      return;
    }
    router.push("/admin/cycles");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={busy}
      className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-zinc-800"
    >
      {busy ? "Deleting..." : "Delete cycle"}
    </button>
  );
}
