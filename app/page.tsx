// Participant landing — name + token entry. If already authenticated, redirect
// to /problems to resume the flow.

import { redirect } from "next/navigation";
import { getCurrentParticipant } from "@/lib/auth/participant";
import { LoginForm } from "./login-form";

type SearchParams = Promise<{ token?: string }>;

export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const participant = await getCurrentParticipant();
  if (participant) {
    redirect("/problems");
  }
  const { token } = await searchParams;

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-6">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            AI capability assessment
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Enter your name and the token you received to begin.
          </p>
        </div>
        <LoginForm initialToken={token ?? ""} />
      </div>
    </main>
  );
}
