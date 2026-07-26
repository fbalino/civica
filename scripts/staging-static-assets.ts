import { readFileSync, writeFileSync } from "node:fs";

import {
  buildStagingStaticAssetManifest,
  serializeStagingStaticAssetManifest,
  stagingStaticAssetManifestErrors,
  stagingStaticAssetManifestSha256,
  type StagingStaticAssetManifest,
} from "../src/lib/qa/staging-static-assets";

function argument(name: string) {
  return process.argv
    .find((value) => value.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
}

const root = argument("root") ?? ".vercel/output/static";
const output = argument("out");
const verify = argument("verify");

if (Boolean(output) === Boolean(verify)) {
  throw new Error("Pass exactly one of --out=<manifest> or --verify=<manifest>");
}

if (output) {
  const manifest = buildStagingStaticAssetManifest(root);
  writeFileSync(output, serializeStagingStaticAssetManifest(manifest));
  console.log(
    JSON.stringify({
      fileCount: manifest.fileCount,
      totalBytes: manifest.totalBytes,
      manifestSha256: stagingStaticAssetManifestSha256(manifest),
      output,
    }),
  );
} else if (verify) {
  const manifest = JSON.parse(
    readFileSync(verify, "utf8"),
  ) as StagingStaticAssetManifest;
  const errors = stagingStaticAssetManifestErrors(root, manifest);
  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }
  console.log(
    JSON.stringify({
      fileCount: manifest.fileCount,
      totalBytes: manifest.totalBytes,
      manifestSha256: stagingStaticAssetManifestSha256(manifest),
      verified: verify,
    }),
  );
}
