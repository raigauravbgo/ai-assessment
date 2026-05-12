import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth/admin";
import { SignOutButton } from "./sign-out-button";

export default async function AuthedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isAdmin())) {
    redirect("/admin/login");
  }
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Link
            href="/admin"
            className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
          >
            AI capability assessment · admin
          </Link>
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
