import { mkdirSync, writeFileSync } from "node:fs";

import {
  atlasSurfaceMatrixHash,
  renderAtlasSurfaceMatrix,
} from "../src/lib/atlas/surface-data-matrix";

const path = "data/atlas-surface-data-matrix.v1.json";
mkdirSync("data", { recursive: true });
writeFileSync(path, renderAtlasSurfaceMatrix());
console.log(`Wrote ${path}; ${atlasSurfaceMatrixHash()}.`);
