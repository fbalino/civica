import "../../v2.css";
import { getEuropeCountryViews } from "@/lib/v2/europe-data";
import { V2EuropeMap } from "@/components/v2/V2EuropeMap";

export const metadata = {
  title: "v2 — Europe choropleth",
};

export default async function V2MapPreviewPage() {
  const views = await getEuropeCountryViews();
  return (
    <div className="v2-scope">
      <div className="v2-showcase">
        <div className="v2-showcase__header">
          <span className="v2-showcase__eyebrow">
            Civica Atlas · Design System v2 · 08 Map
          </span>
        </div>
        <h1 className="v2-showcase__title">Europe.</h1>
        <p className="v2-showcase__lede">
          Real DB-backed choropleth using the v2 multi-hue indicator ramp
          (warm sand → deep navy). Hover any country to surface the v2
          hover card with live data from the <code>jurisdictions</code>
          table.
        </p>

        <V2EuropeMap views={views} />

        <p
          style={{
            fontFamily: "var(--v2-font-body)",
            fontSize: 13,
            color: "var(--v2-text-muted)",
            marginTop: 16,
            lineHeight: 1.6,
          }}
        >
          Data: <code>jurisdictions</code> table (cache columns —{" "}
          <code>population</code>, <code>gdp_billions</code>,{" "}
          <code>government_type</code>). GDP per capita = (GDP USD ÷ pop).
          Hero image fetched lazily on hover from Wikipedia REST.
          Country geometry: world-atlas TopoJSON @ 50m, projected via
          Civica&apos;s existing <code>map-geom.ts</code> equirectangular
          helper.
        </p>
      </div>
    </div>
  );
}
