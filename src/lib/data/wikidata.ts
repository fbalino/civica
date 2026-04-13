const SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";
const USER_AGENT = "Civica/1.0 (https://civica.app; civica@example.com)";
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;

export interface SparqlBinding {
  [key: string]: { type: string; value: string };
}

export interface SparqlResult {
  results: { bindings: SparqlBinding[] };
}

export async function sparqlQuery(query: string): Promise<SparqlBinding[]> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(
        `${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`,
        {
          headers: {
            Accept: "application/sparql-results+json",
            "User-Agent": USER_AGENT,
          },
        }
      );

      if (response.status === 429) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      if (!response.ok) {
        throw new Error(
          `SPARQL query failed: ${response.status} ${response.statusText}`
        );
      }

      const data: SparqlResult = await response.json();
      return data.results.bindings;
    } catch (err) {
      lastError = err as Error;
      if (attempt < MAX_RETRIES - 1) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError ?? new Error("SPARQL query failed after retries");
}

export async function getHeadsOfState(): Promise<SparqlBinding[]> {
  return sparqlQuery(`
    SELECT ?state ?stateLabel ?headOfState ?headOfStateLabel ?headOfGov ?headOfGovLabel WHERE {
      ?state wdt:P31 wd:Q3624078 .
      OPTIONAL { ?state wdt:P35 ?headOfState . }
      OPTIONAL { ?state wdt:P6  ?headOfGov . }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
  `);
}

export async function getLegislatures(): Promise<SparqlBinding[]> {
  return sparqlQuery(`
    SELECT ?state ?stateLabel ?leg ?legLabel WHERE {
      ?state wdt:P31 wd:Q3624078 .
      ?state wdt:P194 ?leg .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
  `);
}

export function extractQid(uri: string): string {
  const match = uri.match(/Q\d+$/);
  return match ? match[0] : uri;
}
