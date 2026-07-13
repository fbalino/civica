import assert from "node:assert/strict";
import test from "node:test";
import {
  findNestedMainViolations,
  findBannerContentinfoViolations,
  findMultipleH1Violations,
} from "./validate-landmarks";

// ---------------------------------------------------------------------------
// Rule 1 — nested-main
// ---------------------------------------------------------------------------

test("PASS: the root layout is exempt from the nested-main rule", () => {
  const src = `export default function RootLayout({ children }) {
    return (
      <body>
        <main style={{ flex: 1 }}>{children}</main>
      </body>
    );
  }`;
  assert.deepEqual(findNestedMainViolations("src/app/layout.tsx", src), []);
});

test("PASS: global-error.tsx is exempt (it replaces the whole document)", () => {
  const src = `<html><body><main>Error</main></body></html>`;
  assert.deepEqual(findNestedMainViolations("src/app/global-error.tsx", src), []);
});

test("PASS: a page.tsx with no <main> at all", () => {
  const src = `export default function Page() { return <div className="editorial-page">Hi</div>; }`;
  assert.deepEqual(findNestedMainViolations("src/app/about/page.tsx", src), []);
});

test("PASS: a commented-out or prose-mentioned <main> is not real JSX", () => {
  const src = `
    // Not a <main>: the root layout already provides the page's single main
    // landmark, so this content block is a <div>.
    /* role="main" belongs only to the root layout */
    export function Foo() { return <div />; }
  `;
  assert.deepEqual(findNestedMainViolations("src/app/blog/page.tsx", src), []);
});

test("FAIL: a page.tsx declaring its own <main>", () => {
  const src = `export default function Page() { return <main className="editorial-page">Hi</main>; }`;
  const violations = findNestedMainViolations("src/app/error.tsx", src);
  assert.equal(violations.length, 1);
  assert.equal(violations[0]!.rule, "nested-main");
});

test("FAIL: a layout.tsx declaring its own <main>", () => {
  const src = `export default function Layout({ children }) { return <div><main className="admin-content">{children}</main></div>; }`;
  const violations = findNestedMainViolations(
    "src/app/(coding)/admin/pulse-coding/layout.tsx",
    src,
  );
  assert.equal(violations.length, 1);
});

test("FAIL: role=\"main\" attribute even without a literal <main> tag", () => {
  const src = `<div role="main" className="fake-main">Hi</div>`;
  const violations = findNestedMainViolations("src/app/foo/page.tsx", src);
  assert.equal(violations.length, 1);
});

test("does not false-positive on custom elements like <main-content>", () => {
  const src = `<main-content className="wrapper">Hi</main-content>`;
  assert.deepEqual(findNestedMainViolations("src/app/foo/page.tsx", src), []);
});

test("violations report a 1-based line number matching the source", () => {
  const src = ["const x = 1;", "const y = 2;", '<main className="z">x</main>', ""].join(
    "\n",
  );
  const violations = findNestedMainViolations("src/app/foo/page.tsx", src);
  assert.equal(violations.length, 1);
  assert.equal(violations[0]!.line, 3);
});

// ---------------------------------------------------------------------------
// Rule 2 — banner-contentinfo-misuse
// ---------------------------------------------------------------------------

test("PASS: implicit <header>/<footer> semantics with no manual role", () => {
  const src = `<header className="site-header"><nav /></header><footer className="site-footer" />`;
  assert.deepEqual(findBannerContentinfoViolations("src/components/SiteHeader.tsx", src), []);
});

test("PASS: unrelated roles are untouched", () => {
  const src = `<div role="dialog" aria-modal="true" /><div role="group" />`;
  assert.deepEqual(findBannerContentinfoViolations("src/app/foo/page.tsx", src), []);
});

test("FAIL: manual role=\"banner\"", () => {
  const src = `<header role="banner" className="ds-top">Hi</header>`;
  const violations = findBannerContentinfoViolations("src/app/design-system/page.tsx", src);
  assert.equal(violations.length, 1);
  assert.equal(violations[0]!.rule, "banner-contentinfo-misuse");
});

test("FAIL: manual role='contentinfo' (single-quoted)", () => {
  const src = `<footer role='contentinfo'>Hi</footer>`;
  const violations = findBannerContentinfoViolations("src/app/foo/page.tsx", src);
  assert.equal(violations.length, 1);
});

test("FAIL: braced role={\"banner\"} expression form", () => {
  const src = `<header role={"banner"}>Hi</header>`;
  const violations = findBannerContentinfoViolations("src/app/foo/page.tsx", src);
  assert.equal(violations.length, 1);
});

// ---------------------------------------------------------------------------
// Rule 3 — multiple-h1
// ---------------------------------------------------------------------------

test("PASS: exactly one <h1>", () => {
  const src = `<h1 className="page-heading">Title</h1>`;
  assert.deepEqual(findMultipleH1Violations("src/app/foo/page.tsx", src), []);
});

test("PASS: zero <h1> (heading composed from an imported component — not this script's job)", () => {
  const src = `export default function Page() { return <ContactClient />; }`;
  assert.deepEqual(findMultipleH1Violations("src/app/contact/page.tsx", src), []);
});

test("FAIL: two <h1> tags rendered in the same branch", () => {
  const src = `
    return (
      <div>
        <h1>First</h1>
        <h1>Second</h1>
      </div>
    );
  `;
  const violations = findMultipleH1Violations("src/app/foo/page.tsx", src);
  assert.equal(violations.length, 2);
  assert.ok(violations.every((v) => v.rule === "multiple-h1"));
});

test("does not false-positive on <h10>-shaped tokens or prose", () => {
  const src = `<h10>not a heading</h10>`;
  assert.deepEqual(findMultipleH1Violations("src/app/foo/page.tsx", src), []);
});

test("multiple-h1 line numbers are reported per occurrence", () => {
  const src = ["<div>", "<h1>A</h1>", "<p>x</p>", "<h1>B</h1>", "</div>"].join("\n");
  const violations = findMultipleH1Violations("src/app/foo/page.tsx", src);
  assert.deepEqual(
    violations.map((v) => v.line),
    [2, 4],
  );
});
