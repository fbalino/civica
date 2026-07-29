import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const globals = readFileSync(new URL("./globals.css", import.meta.url), "utf8");

test("the shared sr-only utility keeps content off the visual canvas", () => {
  const block = globals.match(/\.sr-only\s*\{([^}]+)\}/)?.[1];

  assert.ok(block, "globals.css must define the shared .sr-only utility");
  assert.match(block, /position:\s*absolute/);
  assert.match(block, /width:\s*var\(--border-hairline\)/);
  assert.match(block, /height:\s*var\(--border-hairline\)/);
  assert.match(block, /overflow:\s*hidden/);
  assert.match(block, /clip:\s*rect\(0,\s*0,\s*0,\s*0\)/);
  assert.match(block, /clip-path:\s*inset\(50%\)/);
  assert.match(block, /white-space:\s*nowrap/);
});
