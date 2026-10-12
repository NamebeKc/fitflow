// scripts/design/parse-check.mjs
/**
 * ── SYNTAX GATE ─────────────────────────────────────────────────────
 * Runs the TypeScript parser over the files given on the command line
 * and reports every parse diagnostic.
 *
 * WHY THIS EXISTS. `npx tsc --noEmit` on this repo does not complete
 * through the remote bridge — it was left running for seventeen
 * minutes and then two days, and produced zero bytes both times. That
 * made "it compiles" unverifiable, and an unverifiable claim is worse
 * than an absent one. This closes the cheaper half of the gap: it
 * cannot resolve types or check assignability, but it catches every
 * unbalanced brace, bad generic and malformed JSX, which is the class
 * of mistake that machine-written edits actually produce.
 *
 * It is NOT a substitute for a real type-check. Run
 * `npx tsc --noEmit` natively on Windows before deploying.
 *
 *   node scripts/design/parse-check.mjs $(git diff --name-only | grep -E '\.tsx?$')
 *
 * Exits 1 on any diagnostic, so it works as a pre-push gate.
 */
import ts from "typescript";
import fs from "node:fs";

const files = process.argv.slice(2).filter((f) => /\.tsx?$/.test(f));
if (files.length === 0) {
  console.log("parse-check: no TypeScript files given");
  process.exit(0);
}

let failed = 0;
for (const file of files) {
  if (!fs.existsSync(file)) {
    console.log(`${file}: missing`);
    failed += 1;
    continue;
  }
  const text = fs.readFileSync(file, "utf8");
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.ESNext,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const diagnostics = source.parseDiagnostics ?? [];
  if (diagnostics.length > 0) {
    failed += 1;
    for (const d of diagnostics) {
      const { line, character } = source.getLineAndCharacterOfPosition(d.start);
      const message = ts.flattenDiagnosticMessageText(d.messageText, " ");
      console.log(`${file}:${line + 1}:${character + 1}  ${message}`);
    }
  }
}

console.log(
  failed === 0
    ? `parse-check: OK (${files.length} file${files.length === 1 ? "" : "s"})`
    : `parse-check: FAILED in ${failed} file${failed === 1 ? "" : "s"}`,
);
process.exit(failed === 0 ? 0 : 1);
