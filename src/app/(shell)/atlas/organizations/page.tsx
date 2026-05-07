import { redirect } from "next/navigation";

export const revalidate = 3600;

// /atlas/organizations bare URL → default to UN. Keeps the route addressable
// from the left-rail "Organizations" toggle even when no slug is in the URL.
export default function OrgIndexRedirect() {
  redirect("/atlas/organizations/un");
}
