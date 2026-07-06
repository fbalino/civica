/**
 * Phase 5.5 — sentence embeddings for the clustering pipeline.
 *
 * Wraps `@huggingface/transformers` (the Xenova fork's modern home)
 * with a lazy-init pipeline. The all-MiniLM-L6-v2 model produces
 * 384-dim embeddings in ~50ms/record on CPU and is small enough
 * (~25MB) to ship in process.
 *
 * Lazy-init pattern (same as the Anthropic SDK): the dynamic import
 * runs after dotenv has had a chance to populate env vars, and the
 * model itself only downloads/loads on first use.
 */

const MODEL = "Xenova/all-MiniLM-L6-v2";
const POOLING = "mean";
const NORMALIZE = true;

type Pipeline = (
  input: string | string[],
  opts?: { pooling?: "mean" | "cls" | "none"; normalize?: boolean }
) => Promise<{ data: Float32Array | number[]; dims: number[] }>;

let pipelineCache: Pipeline | null = null;
let loadingPromise: Promise<Pipeline> | null = null;

async function loadPipeline(): Promise<Pipeline> {
  if (pipelineCache) return pipelineCache;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const { pipeline, env } = await import("@huggingface/transformers");
    // Cache models in node_modules-adjacent dir so subsequent runs
    // are instant. The default uses ~/.cache/huggingface; that's fine.
    env.allowRemoteModels = true;
    const p = (await pipeline("feature-extraction", MODEL)) as unknown as Pipeline;
    pipelineCache = p;
    return p;
  })();

  return loadingPromise;
}

/** Embed multiple texts in one call — much faster than embedding
 *  one-at-a-time. */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const pipe = await loadPipeline();
  const result = await pipe(texts, { pooling: POOLING, normalize: NORMALIZE });
  // result.dims = [N, 384]; result.data is flat Float32Array of length N×384.
  const [n, dim] = result.dims;
  const flat = Array.from(result.data);
  const out: number[][] = [];
  for (let i = 0; i < n; i++) {
    out.push(flat.slice(i * dim, (i + 1) * dim));
  }
  return out;
}

/** Cosine similarity for normalized vectors = dot product. */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}

/**
 * Like {@link embedBatch}, but returns `null` (instead of throwing) when the
 * local model can't load — e.g. the ONNX native runtime (`libonnxruntime.so`)
 * is absent from the serverless environment. The clustering pipeline treats a
 * null result as "no embeddings available" and falls back to lexical
 * similarity, so the daily cron never dies on a missing native binary.
 */
export async function tryEmbedBatch(
  texts: string[]
): Promise<number[][] | null> {
  try {
    return await embedBatch(texts);
  } catch (err) {
    console.warn(
      `[embed] local embedding model unavailable (${
        (err as Error).message?.slice(0, 90) ?? String(err)
      }); clustering will fall back to lexical similarity.`
    );
    return null;
  }
}

const LEXICAL_STOPWORDS = new Set([
  "the", "and", "for", "that", "with", "from", "has", "have", "was", "were",
  "are", "his", "her", "its", "their", "they", "this", "after", "over",
  "into", "amid", "says", "said", "will", "who", "not", "but", "out", "new",
]);

/**
 * Lexical similarity — Jaccard overlap of significant tokens (≥3 letters,
 * stopwords removed). The embedding-free fallback for clustering same-event
 * coverage when the ML model isn't available. Weaker than semantic embeddings
 * on paraphrased or cross-language duplicates, but reliably groups near-
 * duplicate stories that share concrete terms (names, places, actions).
 */
export function lexicalSimilarity(a: string, b: string): number {
  const toks = (s: string): Set<string> => {
    const m = s.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [];
    return new Set(m.filter((t) => !LEXICAL_STOPWORDS.has(t)));
  };
  const sa = toks(a);
  const sb = toks(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  return inter / (sa.size + sb.size - inter);
}
