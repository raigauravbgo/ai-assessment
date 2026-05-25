"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteParticipantButton({
  participantId,
  participantName,
  hasSubmission,
}: {
  participantId: string;
  participantName: string;
  hasSubmission: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function onDelete() {
    const warn = hasSubmission
      ? `Delete ${participantName}? This will also wipe their submission, scoring, and your decision. Cannot be undone.`
      : `Delete ${participantName}? Cannot be undone.`;
    if (!confirm(warn)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/participants/${participantId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      alert("Delete failed — check server logs.");
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={busy}
      className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
    >
      {busy ? "..." : "Delete"}
    </button>
  );
}
