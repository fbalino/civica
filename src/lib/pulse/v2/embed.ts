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

/** Embed a single text into a 384-dim vector. */
export async function embed(text: string): Promise<number[]> {
  const pipe = await loadPipeline();
  const result = await pipe(text, { pooling: POOLING, normalize: NORMALIZE });
  return Array.from(result.data);
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
