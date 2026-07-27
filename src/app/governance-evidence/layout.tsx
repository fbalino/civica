import { connection } from "next/server";

export default async function GovernanceEvidenceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // This route reads current research-panel rows from Neon. Keep that work at
  // request time so a credential-free production build never queries the live
  // database while prerendering.
  await connection();

  return children;
}
