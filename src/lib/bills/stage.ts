/**
 * Map a free-form status string from a parliament source to the 0-4
 * stage the BillsTab UI renders. Extracted from the original inline
 * implementation in `src/app/api/countries/[slug]/bills/route.ts:11`
 * so all source adapters can share it.
 *
 * Stage scale (matches `src/components/atlas/data.ts` Bill.stage):
 *   0 = draft / introduced / unknown
 *   1 = in committee / first reading
 *   2 = floor / on the order paper / engrossed / 3rd reading
 *   3 = passed one chamber
 *   4 = enacted / royal assent / signed
 */
export function statusToStage(status: string | null | undefined): number {
  if (!status) return 0;
  const s = status.toLowerCase();
  if (
    s.includes("enacted") ||
    s.includes("became law") ||
    s.includes("royal assent") ||
    s.includes("became public law")
  ) {
    return 4;
  }
  if (
    s.includes("presented to the president") ||
    s.includes("signed by the president") ||
    s.includes("passed senate") ||
    s.includes("passed the senate") ||
    s.includes("passed house") ||
    s.includes("passed the house") ||
    s.includes("agreed to in senate") ||
    s.includes("agreed to in house")
  ) {
    return 3;
  }
  if (
    s.includes("floor") ||
    s.includes("engrossed") ||
    s.includes("ordered to be reported") ||
    s.includes("placed on") ||
    s.includes("report stage") ||
    s.includes("3rd reading") ||
    s.includes("third reading")
  ) {
    return 2;
  }
  if (
    s.includes("committee") ||
    s.includes("referred to") ||
    s.includes("reading") ||
    s.includes("introduced")
  ) {
    return 1;
  }
  // German (Bundestag DIP) — "beratungsstand" free text
  if (
    s.includes("verkündet") ||
    s.includes("ausgefertigt") ||
    s.includes("in kraft")
  ) {
    return 4;
  }
  if (s.includes("verabschiedet") || s.includes("angenommen")) {
    return 3;
  }
  if (
    s.includes("ausschuss") ||
    s.includes("beschlussempfehlung") ||
    s.includes("beraten")
  ) {
    return 2;
  }
  if (s.includes("zugeleitet") || s.includes("eingebracht")) {
    return 1;
  }
  // French (Assemblée Nationale + Sénat) — libelleActe + état du dossier
  if (
    s.includes("promulgué") ||
    s.includes("promulgation") ||
    s.includes("loi du")
  ) {
    return 4;
  }
  if (
    s.includes("adoption définitive") ||
    s.includes("adopté définitivement") ||
    s.includes("adoptée définitivement")
  ) {
    return 3;
  }
  if (
    s.includes("commission") ||
    s.includes("rapport") ||
    s.includes("examen")
  ) {
    return 2;
  }
  if (
    s.includes("première lecture") ||
    s.includes("deuxième lecture") ||
    s.includes("dépôt") ||
    s.includes("déposé") ||
    s.includes("déposée")
  ) {
    return 1;
  }
  return 0;
}
