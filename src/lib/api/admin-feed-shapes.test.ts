import assert from "node:assert/strict";
import test from "node:test";

import {
  shapeAdminAdvisoryFeed,
  shapeAdminContactFeed,
} from "./admin-feed-shapes";

const now = new Date("2026-07-13T12:00:00.000Z");

test("admin feed projections reject future secret columns", () => {
  const secret = "postgres://owner:secret@example.test/civica";
  assert.throws(() =>
    shapeAdminContactFeed({
      submissions: [
        {
          id: "00000000-0000-4000-8000-000000000001",
          name: "Reader",
          email: "reader@example.test",
          subject: "Question",
          message: "Hello",
          ipAddress: "203.0.113.5",
          status: "new",
          createdAt: now,
          secretToken: secret,
        },
      ],
      limit: 50,
      offset: 0,
    }),
  );
  assert.throws(() =>
    shapeAdminAdvisoryFeed({
      applications: [
        {
          id: "00000000-0000-4000-8000-000000000002",
          name: "Scholar",
          email: "scholar@example.test",
          institution: "University",
          role: "Professor",
          expertiseArea: "Comparative politics",
          experience: "Long-form application text",
          links: null,
          cvUrl: null,
          status: "new",
          createdAt: now,
          credentialHash: secret,
        },
      ],
      limit: 50,
      offset: 0,
    }),
  );
});
