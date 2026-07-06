/**
 * IndexNow submission CLI — push the sitemap's URLs to IndexNow.
 *
 * IndexNow is a shared ping protocol: one submission notifies every
 * participating search engine at once. Participants include Microsoft
 * Bing, Yandex, Naver, Seznam.cz, and Yep. NOTE: Google does NOT
 * participate in IndexNow — Google discovery still relies on the
 * sitemap + normal crawling, so this script does nothing for Google
 * ranking/indexing. It is purely a Bing/Yandex/Naver/Seznam/Yep signal.
 *
 * How it works:
 *   1. Fetch https://civicaatlas.org/sitemap.xml and extract every <loc>.
 *   2. POST the batch to https://api.indexnow.org/indexnow as
 *      { host, key, keyLocation, urlList } (JSON). One request, up to
 *      10,000 URLs per the protocol limit.
 *
 * Key ownership is proven by serving the key as plain text at
 * `keyLocation` (https://civicaatlas.org/<KEY>.txt). That file lives at
 * `public/<KEY>.txt` in this repo and is deployed with the site. The key
 * is NOT a secret — the protocol REQUIRES it to be published at that URL,
 * so committing it here and defaulting to it below is by design.
 *
 * This is a MANUAL / post-deploy tool for now — there is no cron. Run it
 * after a deploy that adds or materially changes pages so Bing & friends
 * re-crawl promptly.
 *
 * Usage:
 *   npm run seo:indexnow
 *   # or, to override the key (must match the deployed public/<KEY>.txt):
 *   INDEXNOW_KEY=<hexkey> npm run seo:indexnow
 *   # or point at a different origin (e.g. a preview deploy):
 *   INDEXNOW_HOST=civica-preview.vercel.app npm run seo:indexnow
 *
 * Exit code is non-zero on any HTTP failure (sitemap fetch or the
 * IndexNow POST), so CI / post-deploy hooks can detect a bad run.
 */

// The published key. Defaults to the value served at
// https://civicaatlas.org/<KEY>.txt (public/<KEY>.txt in this repo).
// Overridable via INDEXNOW_KEY, but the override MUST match whatever
// key file is actually deployed, or IndexNow rejects the submission.
const DEFAULT_INDEXNOW_KEY = "9a62319232d87013d1330c6cab03bb23";

const KEY = (process.env.INDEXNOW_KEY || DEFAULT_INDEXNOW_KEY).trim();
const HOST = (process.env.INDEXNOW_HOST || "civicaatlas.org").trim();
const ORIGIN = `https://${HOST}`;
const SITEMAP_URL = `${ORIGIN}/sitemap.xml`;
const KEY_LOCATION = `${ORIGIN}/${KEY}.txt`;
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

// Protocol maximum per submission.
const MAX_URLS = 10_000;

/** Pull every <loc>…</loc> URL out of a sitemap XML string. */
function extractUrls(xml: string): string[] {
  const urls: string[] = [];
  const re = /<loc>([^<]+)<\/loc>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const raw = m[1].trim();
    if (!raw) continue;
    // Sitemaps XML-escape ampersands (e.g. compare?c=a&amp;c=b).
    // IndexNow wants the real URL, so unescape the standard entities.
    const decoded = raw
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'");
    urls.push(decoded);
  }
  return urls;
}

async function main() {
  if (!/^[0-9a-fA-F]{8,128}$/.test(KEY)) {
    console.error(
      `[indexnow] Refusing to submit: INDEXNOW_KEY "${KEY}" is not a valid hex key (8–128 hex chars).`,
    );
    process.exit(1);
  }

  console.log(`[indexnow] host:         ${HOST}`);
  console.log(`[indexnow] keyLocation:  ${KEY_LOCATION}`);
  console.log(`[indexnow] sitemap:      ${SITEMAP_URL}`);
  console.log(
    "[indexnow] note: Google does NOT participate in IndexNow — this pings Bing / Yandex / Naver / Seznam / Yep only.",
  );

  // 1) Fetch the sitemap.
  let xml: string;
  try {
    const res = await fetch(SITEMAP_URL, {
      headers: { "user-agent": "civica-indexnow-submitter" },
    });
    if (!res.ok) {
      console.error(
        `[indexnow] Sitemap fetch failed: ${res.status} ${res.statusText}`,
      );
      process.exit(1);
    }
    xml = await res.text();
  } catch (err) {
    console.error("[indexnow] Sitemap fetch threw:", err);
    process.exit(1);
    return; // unreachable, keeps TS happy
  }

  // 2) Extract + de-dupe URLs; keep only same-host URLs (IndexNow rejects
  //    a batch that mixes hosts).
  const all = Array.from(new Set(extractUrls(xml)));
  const urlList = all.filter((u) => {
    try {
      return new URL(u).host === HOST;
    } catch {
      return false;
    }
  });
  const skipped = all.length - urlList.length;

  console.log(
    `[indexnow] extracted ${all.length} unique URLs (${urlList.length} on ${HOST}${
      skipped ? `, ${skipped} off-host skipped` : ""
    }).`,
  );

  if (urlList.length === 0) {
    console.error("[indexnow] No URLs to submit — aborting.");
    process.exit(1);
  }
  if (urlList.length > MAX_URLS) {
    console.error(
      `[indexnow] ${urlList.length} URLs exceeds the ${MAX_URLS}-URL per-submission limit. ` +
        "Split the submission before retrying.",
    );
    process.exit(1);
  }

  // 3) Submit the whole batch in one request.
  const body = {
    host: HOST,
    key: KEY,
    keyLocation: KEY_LOCATION,
    urlList,
  };

  console.log(`[indexnow] POSTing ${urlList.length} URLs to ${INDEXNOW_ENDPOINT} …`);

  let res: Response;
  try {
    res = await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("[indexnow] POST threw:", err);
    process.exit(1);
    return; // unreachable
  }

  const text = await res.text().catch(() => "");

  // IndexNow status codes: 200 OK, 202 Accepted (key validation pending),
  // 400 bad request, 403 key not valid, 422 URLs don't belong to host /
  // key mismatch, 429 too many requests.
  if (res.status === 200 || res.status === 202) {
    console.log(
      `[indexnow] Success: HTTP ${res.status} ${res.statusText}. Submitted ${urlList.length} URLs.`,
    );
    if (text.trim()) console.log(`[indexnow] Response body: ${text.trim()}`);
    process.exit(0);
  }

  console.error(
    `[indexnow] Submission FAILED: HTTP ${res.status} ${res.statusText}.`,
  );
  if (text.trim()) console.error(`[indexnow] Response body: ${text.trim()}`);
  if (res.status === 403) {
    console.error(
      `[indexnow] 403 usually means the key file at ${KEY_LOCATION} is missing or its ` +
        "contents don't match the submitted key. Confirm the deploy served that file.",
    );
  }
  process.exit(1);
}

main().catch((err) => {
  console.error("[indexnow] Unexpected error:", err);
  process.exit(1);
});

export {};
