export type PulseCodingStoreErrorCode =
  "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "INVALID_REQUEST_BODY";

/**
 * Expected, caller-actionable failures from the Pulse coding store.
 *
 * The message remains server-side diagnostic context. Route handlers expose
 * only the closed code through the shared problem-response adapter.
 */
export class PulseCodingStoreError extends Error {
  readonly code: PulseCodingStoreErrorCode;

  constructor(code: PulseCodingStoreErrorCode, message: string) {
    super(message);
    this.name = "PulseCodingStoreError";
    this.code = code;
  }
}
