import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth/admin";
import { AdminLoginForm } from "./admin-login-form";

export default async function AdminLoginPage() {
  if (await isAdmin()) {
    redirect("/admin");
  }
  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-6">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Admin sign-in
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Single-user dashboard. Enter the admin password.
        </p>
        <AdminLoginForm />
      </div>
    </main>
  );
}
