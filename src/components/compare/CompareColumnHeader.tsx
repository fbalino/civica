import { CountryFlag } from "@/components/CountryFlag";

interface CompareColumnHeaderProps {
  slug: string;
  name: string;
  iso2: string | null;
  seriesColor: string;
}

/**
 * Shared header cell shown at the top of every section column. Flag, country
 * name, and a thin series-color underline that ties the column back to the
 * selector card with the matching color.
 */
export function CompareColumnHeader({
  slug,
  name,
  iso2,
  seriesColor,
}: CompareColumnHeaderProps) {
  return (
    <div className="compare-col-header" style={{ borderBottomColor: seriesColor }}>
      <CountryFlag iso2={iso2} size={28} />
      <a href={`/country/${slug}`} className="compare-col-header-name">
        {name}
      </a>
    </div>
  );
}
