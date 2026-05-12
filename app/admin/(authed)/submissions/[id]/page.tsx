import { notFound } from "next/navigation";
import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { DIAGNOSTIC_QUESTIONS } from "@/lib/config/diagnostic-questions";
import { DecisionForm } from "./decision-form";
import { RescoreButton } from "./rescore-button";

type FullSubmission = Prisma.SubmissionGetPayload<{
  include: {
    participant: true;
    problem: true;
    cycle: true;
    score: true;
    adminDecision: true;
    diagnosticResponses: true;
  };
}>;

type ScoreRow = NonNullable<FullSubmission["score"]>;
type ProblemRow = FullSubmission["problem"];

// PRD §5.5: render order is REASONING FIRST, then suggested bucket, then admin
// action. This forces the admin to form an independent read before seeing the
// recommendation. Do not reorder these sections.

type Params = Promise<{ id: string }>;

export default async function SubmissionDetail({ params }: { params: Params }) {
  const { id } = await params;
  const submission = await prisma.submission.findUnique({
    where: { id },
    include: {
      participant: true,
      problem: true,
      cycle: true,
      score: true,
      adminDecision: true,
      diagnosticResponses: { orderBy: { questionIndex: "asc" } },
    },
  });
  if (!submission) notFound();

  return (
    <div className="space-y-8">
      <Header submission={submission} />

      {!submission.score ? (
        <NoScoreYet submission={submission} />
      ) : (
        <>
          <DimensionCards score={submission.score} problem={submission.problem} />
          <DiagnosticAnswers submission={submission} />
          <MostRevealingPhrase score={submission.score} />
          <BucketSuggestion score={submission.score} />
          <AdminAction submission={submission} />
        </>
      )}
    </div>
  );
}

function Header({ submission }: { submission: FullSubmission }) {
  return (
    <div>
      <Link href="/admin" className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
        ← all submissions
      </Link>
      <h1 className="mt-2 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        {submission.participant.name} · {submission.problem.title}
      </h1>
      <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        cycle: {submission.cycle.name} · status: {submission.status} · selected{" "}
        {submission.selectedAt.toISOString().slice(0, 16).replace("T", " ")} UTC
        {submission.submittedAt && (
          <> · submitted {submission.submittedAt.toISOString().slice(0, 16).replace("T", " ")} UTC</>
        )}
      </div>
    </div>
  );
}

function NoScoreYet({
  submission,
}: {
  submission: { id: string; status: string; zipPath: string | null };
}) {
  if (submission.status === "selected") {
    return (
      <Card>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          Participant has picked a problem but hasn&apos;t uploaded their zip yet.
        </p>
      </Card>
    );
  }
  if (submission.status === "expired") {
    return (
      <Card>
        <p className="text-sm text-amber-700 dark:text-amber-300">
          48-hour window expired with no submission.
        </p>
      </Card>
    );
  }
  return (
    <Card>
      <p className="text-sm text-zinc-700 dark:text-zinc-300">
        Zip was submitted but scoring hasn&apos;t produced a result yet — either
        still running or the scoring pipeline errored (check the server logs).
      </p>
      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        Manually trigger scoring:
      </p>
      <div className="mt-2">
        <RescoreButton submissionId={submission.id} />
      </div>
    </Card>
  );
}

function DimensionCards({ score, problem }: { score: ScoreRow; problem: ProblemRow }) {
  const zoneReasoning = score.zoneReasoning as
    | { floor: string; middle: string; stretch: string }
    | null;
  const trapEvidence = score.trapEvidence as Array<{
    trapName: string;
    status: string;
    evidenceCitation: string;
  }>;
  const aiMarkers = score.aiFingerprintMarkers as Array<{
    marker: string;
    rating: number;
    codeExample: string;
  }>;
  const trapDefs = problem.trapDefinitions as Array<{ name: string }>;

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Five dimension scorecards
      </h2>

      <Card title={`Zone completion · ${score.zoneScore}/3`}>
        {zoneReasoning && (
          <dl className="space-y-2 text-sm">
            <Observation label="Floor" cleared={score.zoneScore >= 1} text={zoneReasoning.floor} />
            <Observation label="Middle" cleared={score.zoneScore >= 2} text={zoneReasoning.middle} />
            <Observation label="Stretch" cleared={score.zoneScore >= 3} text={zoneReasoning.stretch} />
          </dl>
        )}
      </Card>

      <Card title="Trap handling">
        <ul className="space-y-3 text-sm">
          {trapEvidence.map((t, i) => (
            <li key={i}>
              <div className="flex items-center gap-2">
                <span className="font-medium text-zinc-900 dark:text-zinc-50">
                  {t.trapName || trapDefs[i]?.name || `Trap ${i + 1}`}
                </span>
                <TrapStatusBadge status={t.status} />
              </div>
              <p className="mt-1 text-zinc-600 dark:text-zinc-400">{t.evidenceCitation}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Card title={`AI fingerprint · ${score.aiFingerprintScore}/5`}>
        <p className="mb-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          {score.aiFingerprintSummary}
        </p>
        <ul className="space-y-2 text-sm">
          {aiMarkers.map((m, i) => (
            <li key={i}>
              <div className="flex items-center gap-2">
                <span className="font-medium text-zinc-900 dark:text-zinc-50">{m.marker}</span>
                <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  {m.rating}/3
                </span>
              </div>
              <p className="mt-1 text-zinc-600 dark:text-zinc-400">{m.codeExample}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Notes quality">
        {score.notesAwarenessScore === null ? (
          <p className="text-sm italic text-zinc-500 dark:text-zinc-400">
            No notes submitted. Per PRD §5.4 D4, absence is no signal — all sub-scores are null,
            not zero.
          </p>
        ) : (
          <>
            <div className="flex gap-4 text-sm">
              <SubScore label="Awareness" value={score.notesAwarenessScore} />
              <SubScore label="Honesty" value={score.notesHonestyScore} />
              <SubScore label="Process" value={score.notesProcessScore} />
            </div>
            {score.notesSummary && (
              <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                {score.notesSummary}
              </p>
            )}
          </>
        )}
      </Card>

      <Card title="Diagnostic responses">
        <div className="flex gap-4 text-sm">
          <SubScore label="Q1" value={score.diagnosticQ1Score} />
          <SubScore label="Q2" value={score.diagnosticQ2Score} />
          <SubScore label="Q3" value={score.diagnosticQ3Score} />
        </div>
      </Card>
    </div>
  );
}

function DiagnosticAnswers({
  submission,
}: {
  submission: {
    notesText: string | null;
    diagnosticResponses: Array<{
      questionIndex: number;
      responseText: string;
    }>;
  };
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Raw participant input
      </h2>
      <Card title="Notes">
        {submission.notesText ? (
          <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-700 dark:text-zinc-300">
            {submission.notesText}
          </p>
        ) : (
          <p className="text-sm italic text-zinc-500 dark:text-zinc-400">
            (empty)
          </p>
        )}
      </Card>
      <Card title="Diagnostic answers">
        <dl className="space-y-3 text-sm">
          {submission.diagnosticResponses.map((r) => (
            <div key={r.questionIndex}>
              <dt className="font-medium text-zinc-900 dark:text-zinc-50">
                {DIAGNOSTIC_QUESTIONS[r.questionIndex]?.text ?? `Q${r.questionIndex}`}
              </dt>
              <dd className="mt-1 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                {r.responseText}
              </dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}

function MostRevealingPhrase({ score }: { score: ScoreRow }) {
  return (
    <Card title="Most revealing phrase">
      <blockquote className="border-l-4 border-zinc-300 pl-4 italic text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
        &ldquo;{score.diagnosticRevealingPhrase}&rdquo;
      </blockquote>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        {score.diagnosticRevealingReason}
      </p>
    </Card>
  );
}

function BucketSuggestion({ score }: { score: ScoreRow }) {
  return (
    <Card title="Suggested bucket">
      <div className="mb-3">
        <span
          className={`inline-block rounded px-3 py-1 text-sm font-medium ${
            score.suggestedBucket === "fast"
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100"
              : score.suggestedBucket === "low"
                ? "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-100"
                : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100"
          }`}
        >
          {score.suggestedBucket} multiplier
        </span>
      </div>
      <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        {score.bucketReasoning}
      </p>
    </Card>
  );
}

function AdminAction({
  submission,
}: {
  submission: {
    id: string;
    adminDecision: {
      confirmedBucket: string | null;
      overrideNote: string | null;
      flagged: boolean;
    } | null;
    score: { suggestedBucket: string } | null;
  };
}) {
  return (
    <Card title="Your decision">
      <DecisionForm
        submissionId={submission.id}
        suggestedBucket={submission.score?.suggestedBucket ?? "slow"}
        existing={submission.adminDecision}
      />
    </Card>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {title && (
        <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          {title}
        </h3>
      )}
      {children}
    </section>
  );
}

function Observation({
  label,
  cleared,
  text,
}: {
  label: string;
  cleared: boolean;
  text: string;
}) {
  return (
    <div className="flex gap-3">
      <dt className="w-20 shrink-0 font-medium text-zinc-700 dark:text-zinc-300">
        {label}{" "}
        <span
          className={`ml-1 ${cleared ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400"}`}
        >
          {cleared ? "✓" : "—"}
        </span>
      </dt>
      <dd className="text-zinc-600 dark:text-zinc-400">{text}</dd>
    </div>
  );
}

function TrapStatusBadge({ status }: { status: string }) {
  const cls =
    status === "caught"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100"
      : status === "partial"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100"
        : "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-100";
  return <span className={`rounded px-1.5 py-0.5 text-xs ${cls}`}>{status}</span>;
}

function SubScore({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        {value === null ? "—" : `${value}/3`}
      </div>
    </div>
  );
}
