import { redirect } from "next/navigation";

export const revalidate = 0;

// Bare /organizations URL → default to the UN. Mirrors the old shell
// behaviour (/atlas/organizations → /atlas/organizations/un), now on the
// standalone reader route.
export default function OrganizationsIndexRedirect() {
  redirect("/organizations/un");
}
