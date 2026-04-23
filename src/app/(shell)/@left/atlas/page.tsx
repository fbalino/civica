import { loadAtlasData } from "@/lib/atlas/load-atlas-data";
import { AtlasMapLeft } from "@/components/atlas/AtlasMapLeft";

export default async function AtlasMapLeftSlot() {
  const { countries } = await loadAtlasData();
  return <AtlasMapLeft countries={countries} />;
}
