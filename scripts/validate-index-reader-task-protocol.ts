import assert from "node:assert/strict";
import { INDEX_READER_TASK_PROTOCOL, INDEX_READER_TASK_PROTOCOL_SHA256, readerTaskProtocolErrors } from "../src/lib/ci/reader-task-protocol";

assert.deepEqual(readerTaskProtocolErrors(), []);
assert.equal(INDEX_READER_TASK_PROTOCOL.conditions.K0.includes("no composite"), true);
assert.equal(INDEX_READER_TASK_PROTOCOL.conditions.K1.includes("derivative"), true);
assert.equal(INDEX_READER_TASK_PROTOCOL.outcomes.primary.length, 2);
console.log(`PASS — reader-task preregistration ${INDEX_READER_TASK_PROTOCOL_SHA256}; human responses remain unopened.`);
