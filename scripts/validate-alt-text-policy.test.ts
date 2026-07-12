import assert from "node:assert/strict";
import test from "node:test";
import {
  blankComments,
  findAltTextViolations,
} from "./validate-alt-text-policy";

// ---------------------------------------------------------------------------
// PASS fixtures — one per DESIGN.md "Alternative text" treatment. None of
// these should ever produce a violation.
// ---------------------------------------------------------------------------

test("PASS: meaningful image with a descriptive alt", () => {
  const src = `<img src="/flags/us.svg" alt="Flag of US" width={20} />`;
  assert.deepEqual(findAltTextViolations("f.tsx", src), []);
});

test("PASS: decorative image carries both alt=\"\" and aria-hidden", () => {
  const src = `<img src={coverPhoto.src} alt="" aria-hidden="true" style={{ objectFit: "cover" }} />`;
  assert.deepEqual(findAltTextViolations("f.tsx", src), []);
});

test("PASS: decorative image with boolean aria-hidden shorthand", () => {
  const src = `<img src={p.file} alt="" aria-hidden />`;
  assert.deepEqual(findAltTextViolations("f.tsx", src), []);
});

test("PASS: next/image <Image> decorative variant", () => {
  const src = `<Image\n  src={img}\n  alt=""\n  aria-hidden="true"\n  width={dims.width}\n/>`;
  assert.deepEqual(findAltTextViolations("f.tsx", src), []);
});

test("PASS: dynamic alt expression is never flagged (cannot prove emptiness statically)", () => {
  // CountryFlag.tsx's own pattern: alt is computed from a `decorative` prop.
  // The mechanical check only enforces the LITERAL alt="" case — reviewers
  // own dynamic-alt correctness per DESIGN.md.
  const src = `<img src={src} alt={alt} aria-hidden={decorative ? true : undefined} />`;
  assert.deepEqual(findAltTextViolations("f.tsx", src), []);
});

test("PASS: a commented-out or prose-mentioned <img> is not real JSX", () => {
  const src = `
    // The card stays light enough to track the cursor (plain lazy <img>).
    /* Historical note: this component used to render a raw <img> here. */
    export function Foo() { return <div />; }
  `;
  assert.deepEqual(findAltTextViolations("f.tsx", src), []);
});

// ---------------------------------------------------------------------------
// FAIL fixtures — one per rule.
// ---------------------------------------------------------------------------

test("FAIL: <img> with no alt attribute at all", () => {
  const src = `<img src="/photo.jpg" width={64} height={48} />`;
  const violations = findAltTextViolations("f.tsx", src);
  assert.equal(violations.length, 1);
  assert.equal(violations[0]!.rule, "missing-alt");
});

test("FAIL: next/image <Image> with no alt attribute at all", () => {
  const src = `<Image\n  src={img}\n  width={64}\n  height={48}\n/>`;
  const violations = findAltTextViolations("f.tsx", src);
  assert.equal(violations.length, 1);
  assert.equal(violations[0]!.rule, "missing-alt");
});

test("FAIL: decorative alt=\"\" missing aria-hidden", () => {
  const src = `<img src={coverMap.src} alt="" style={{ objectFit: "contain" }} />`;
  const violations = findAltTextViolations("f.tsx", src);
  assert.equal(violations.length, 1);
  assert.equal(violations[0]!.rule, "missing-aria-hidden");
});

test("FAIL: alt={\"\"} (braced empty string) missing aria-hidden", () => {
  const src = `<img src={x} alt={""} />`;
  const violations = findAltTextViolations("f.tsx", src);
  assert.equal(violations.length, 1);
  assert.equal(violations[0]!.rule, "missing-aria-hidden");
});

test("FAIL: alt={''} (single-quoted braced empty string) missing aria-hidden", () => {
  const src = `<img src={x} alt={''} />`;
  const violations = findAltTextViolations("f.tsx", src);
  assert.equal(violations.length, 1);
  assert.equal(violations[0]!.rule, "missing-aria-hidden");
});

test("multiple tags in one file are each evaluated independently", () => {
  const src = `
    function Gallery() {
      return (
        <>
          <img src="/a.jpg" alt="A real photo of the summit" />
          <img src="/b.jpg" alt="" aria-hidden="true" />
          <img src="/c.jpg" />
          <img src="/d.jpg" alt="" />
        </>
      );
    }
  `;
  const violations = findAltTextViolations("gallery.tsx", src);
  assert.equal(violations.length, 2);
  assert.deepEqual(
    violations.map((v) => v.rule).sort(),
    ["missing-alt", "missing-aria-hidden"],
  );
});

test("violations report a 1-based line number matching the source", () => {
  const src = ['const x = 1;', 'const y = 2;', '<img src="/z.jpg" />', ''].join(
    "\n",
  );
  const violations = findAltTextViolations("f.tsx", src);
  assert.equal(violations.length, 1);
  assert.equal(violations[0]!.line, 3);
});

// ---------------------------------------------------------------------------
// blankComments — the false-positive guard itself.
// ---------------------------------------------------------------------------

test("blankComments preserves file length and line count (line numbers stay aligned)", () => {
  const src = '// comment with <img> mention\nconst x = /* inline <img/> */ 1;\n';
  const blanked = blankComments(src);
  assert.equal(blanked.length, src.length);
  assert.equal(blanked.split("\n").length, src.split("\n").length);
  assert.ok(!blanked.includes("<img"));
});

test("blankComments does not touch real code outside comments", () => {
  const src = '<img src="/a.jpg" alt="" aria-hidden="true" /> // trailing comment';
  const blanked = blankComments(src);
  assert.ok(blanked.startsWith('<img src="/a.jpg" alt="" aria-hidden="true" />'));
});
