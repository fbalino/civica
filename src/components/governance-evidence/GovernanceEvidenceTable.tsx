import Link from "next/link";
import { DataValueState } from "@/components/DataValueState";
import { SourceDot } from "@/components/SourceDot";
import { DataTable } from "@/components/editorial/DataTable";
import { formatNativeEvidenceValue, formatUncertaintyStatus, type GovernanceEvidenceRow } from "@/lib/ci/governance-evidence";

export function GovernanceEvidenceTable({ countryName, rows }: { countryName: string; rows: GovernanceEvidenceRow[] }) {
  return (
    <DataTable aria-label={`Source-native governance evidence for ${countryName}`}>
      <thead><tr><th>Source and measure</th><th>Native observation</th><th>Publisher uncertainty</th><th>Vintage and access</th></tr></thead>
      <tbody>{rows.map((row) => (
        <tr key={`${row.sourceId}:${row.indicatorId}`}>
          <td><strong>{row.label}</strong><br /><span>{row.sourceOwner} <SourceDot source={row.sourceId} retrievedAt={row.lastSyncAt} /></span><br /><small>{row.construct}</small></td>
          <td className="num"><DataValueState status={row.valueStatus === "observed" ? "observed" : "missing"} reason={row.missingReason}>{row.value === null ? null : <><strong>{formatNativeEvidenceValue(row.value, row.nativeMin, row.nativeMax)}</strong><br /><small>{row.nativeUnit}<br />{row.direction}</small></>}</DataValueState></td>
          <td>{row.uncertaintyLower !== null && row.uncertaintyUpper !== null ? <><strong>{formatNativeEvidenceValue(row.uncertaintyLower, row.nativeMin, row.nativeMax)}–{formatNativeEvidenceValue(row.uncertaintyUpper, row.nativeMin, row.nativeMax)}</strong><br /><small>{formatUncertaintyStatus(row.uncertaintyStatus)}</small></> : <><strong>Not published</strong><br /><small>{formatUncertaintyStatus(row.uncertaintyStatus)}</small></>}</td>
          <td><strong>{row.sourceVintage}</strong><br /><Link href={row.sourceUrl}>Publisher file</Link><br /><small>{row.exportPermission === "allowed" ? "Civica export allowed with attribution" : "Download from publisher; Civica bulk export blocked"}</small></td>
        </tr>
      ))}</tbody>
    </DataTable>
  );
}
