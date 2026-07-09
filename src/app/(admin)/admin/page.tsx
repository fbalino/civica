import { redirect } from "next/navigation";

/**
 * /admin has no content of its own — it's an alias for the default admin
 * view. The (admin) layout already gates this route on the session cookie
 * (redirecting signed-out visitors to /admin/sign-in before this component
 * ever renders), so a signed-in visitor just lands on the same landing tab
 * the wordmark link in the admin shell points to.
 */
export default function AdminIndexPage() {
  redirect("/admin/pulse-review");
}
