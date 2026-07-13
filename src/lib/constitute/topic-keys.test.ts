import assert from "node:assert/strict";
import test from "node:test";
import taxonomy from "./topic-taxonomy.generated.json";
import { isKnownTopic } from "./topics";
import {
  isKnownConstitutionTopic,
  knownConstitutionTopicKeys,
} from "./topic-keys";

test("edge topic keys are the exact checked taxonomy projection", () => {
  const expected = [
    ...new Set([
      ...taxonomy.categories.map((topic) => topic.key),
      ...taxonomy.leaves.map((topic) => topic.key),
    ]),
  ].sort();
  assert.deepEqual(knownConstitutionTopicKeys(), expected);
  for (const key of expected) {
    assert.equal(isKnownConstitutionTopic(key), true);
    assert.equal(isKnownTopic(key), true);
  }
  assert.equal(isKnownConstitutionTopic("not-a-constitute-topic"), false);
});
