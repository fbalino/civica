import test from "node:test";
import assert from "node:assert/strict";
import { INDEX_READER_TASK_PROTOCOL, INDEX_READER_TASK_PROTOCOL_SHA256, readerTaskProtocolErrors } from "./reader-task-protocol";

test("reader protocol is frozen, complete, and cannot promote agent dry runs", () => {
  assert.deepEqual(readerTaskProtocolErrors(), []);
  assert.match(INDEX_READER_TASK_PROTOCOL_SHA256, /^[a-f0-9]{64}$/);
  assert.equal(INDEX_READER_TASK_PROTOCOL.design.minimumQualifiedParticipants, 30);
  assert.match(INDEX_READER_TASK_PROTOCOL.agentDryRun.prohibitedPurpose, /human comprehension/);
});
