import "../../v2.css";
import { CountryHoverCard } from "@/components/v2/CountryHoverCard";

export const metadata = {
  title: "v2 — Atlas country card",
};

export default function AtlasCardPreviewPage() {
  return (
    <div className="v2-scope">
      <div className="v2-preview-meta">
        Civica v2 · Atlas country hover card
      </div>
      <div className="v2-preview-canvas">
        <CountryHoverCard
          name="Estonia"
          officialName="Republic of Estonia"
          iso2="ee"
          heroImageUrl="https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Old_town_of_Tallinn_06-03-2012.jpg/1280px-Old_town_of_Tallinn_06-03-2012.jpg"
          heroImageAlt="Tallinn old town skyline"
          stats={[
            { label: "Political System", value: "Parliamentary Democracy" },
            { label: "GDP per Capita", value: "$31,417", year: "2023" },
            { label: "Population", value: "1.3M", year: "2023" },
          ]}
          ctaHref="/factbook/estonia"
        />
      </div>
    </div>
  );
}
