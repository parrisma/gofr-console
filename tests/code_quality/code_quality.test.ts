import { describe, it } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

type ComplexityAllow = { file: string; function: string };

type AllowlistV1 = {
  large_files?: unknown;
  complexity?: unknown;
};

function repoRootFromHere(): string {
  // tests/code_quality -> tests -> repo root
  return path.resolve(__dirname, "..", "..");
}

function posixRel(root: string, absPath: string): string {
  const rel = path.relative(root, absPath);
  return rel.split(path.sep).join("/");
}

function runOrThrow(
  root: string,
  command: string,
  args: string[],
  label: string,
): void {
  const res = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe",
    env: process.env,
  });

  if (res.status === 0) return;

  const stdout = res.stdout?.trim() ?? "";
  const stderr = res.stderr?.trim() ?? "";
  const detail = [stdout, stderr].filter(Boolean).join("\n");

  throw new Error(
    [
      "",
      "================================================================================",
      `CODE QUALITY GATE FAILED: ${label}`,
      "================================================================================",
      "",
      `Command: ${command} ${args.join(" ")}`,
      detail ? "" : "No output captured from the command.",
      detail,
      "",
      "How to run locally:",
      "- ./scripts/code-quality.sh",
      "- pnpm exec vitest run tests/code_quality -v",
      "================================================================================",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

function readAllowlist(root: string): {
  largeFiles: Set<string>;
  complexity: Set<string>;
} {
  const envPath = process.env.CODE_QUALITY_ALLOWLIST_FILE;
  const defaultPath = "tests/code_quality/allow.json";
  const rawPath = (envPath && envPath.trim()) || defaultPath;
  const allowPath = path.isAbsolute(rawPath)
    ? rawPath
    : path.join(root, rawPath);

  if (!fs.existsSync(allowPath)) {
    // Missing allowlist is non-fatal (treated as empty), same as gofr-dig.
    // Keep it visible so teams can add allowlist entries intentionally.
    // eslint-disable-next-line no-console
    console.warn(
      `code_quality: allowlist missing at ${posixRel(root, allowPath)} (treated as empty)`,
    );
    return { largeFiles: new Set(), complexity: new Set() };
  }

  let parsed: AllowlistV1;
  try {
    parsed = JSON.parse(fs.readFileSync(allowPath, "utf8")) as AllowlistV1;
  } catch (err) {
    throw new Error(
      `Failed to parse code quality allowlist JSON (${posixRel(root, allowPath)}): ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const largeFiles = new Set<string>();
  if (Array.isArray(parsed.large_files)) {
    for (const entry of parsed.large_files) {
      if (typeof entry === "string" && entry.trim())
        largeFiles.add(entry.trim());
      else {
        // eslint-disable-next-line no-console
        console.warn(
          `code_quality: invalid allowlist large_files entry ignored: ${String(entry)}`,
        );
      }
    }
  }

  const complexity = new Set<string>();
  if (Array.isArray(parsed.complexity)) {
    for (const entry of parsed.complexity) {
      const obj = entry as Partial<ComplexityAllow> | null;
      const fileVal = obj?.file;
      const funcVal = obj?.function;
      if (
        typeof fileVal === "string" &&
        fileVal.trim() &&
        typeof funcVal === "string" &&
        funcVal.trim()
      ) {
        complexity.add(`${fileVal.trim()}::${funcVal.trim()}`);
      } else {
        // eslint-disable-next-line no-console
        console.warn(
          `code_quality: invalid allowlist complexity entry ignored: ${JSON.stringify(entry)}`,
        );
      }
    }
  }

  return { largeFiles, complexity };
}

function walkFiles(absDir: string): string[] {
  const out: string[] = [];
  const stack: string[] = [absDir];

  while (stack.length) {
    const cur = stack.pop();
    if (!cur) continue;

    const entries = fs.readdirSync(cur, { withFileTypes: true });
    for (const ent of entries) {
      const abs = path.join(cur, ent.name);
      if (ent.isDirectory()) {
        stack.push(abs);
        continue;
      }
      if (!ent.isFile()) continue;
      out.push(abs);
    }
  }

  return out;
}

function countLines(text: string): number {
  if (!text) return 0;
  let n = 1;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) n++;
  }
  return n;
}

describe("code quality gate", () => {
  it("passes lint and typecheck", () => {
    const root = repoRootFromHere();
    runOrThrow(
      root,
      "bash",
      ["-lc", "./scripts/code-quality.sh"],
      "eslint + tsc",
    );
  }, 180_000);

  it("enforces large-file limit with allowlist", () => {
    const root = repoRootFromHere();
    const allow = readAllowlist(root);

    const SRC_MAX_LINES = 1000;
    const srcDir = path.join(root, "src");
    const files = walkFiles(srcDir).filter(
      (p) => p.endsWith(".ts") || p.endsWith(".tsx"),
    );

    const offenders: Array<{ file: string; lines: number }> = [];
    const allowlisted: Array<{ file: string; lines: number }> = [];

    for (const abs of files) {
      const rel = posixRel(root, abs);
      const lines = countLines(fs.readFileSync(abs, "utf8"));

      if (lines <= SRC_MAX_LINES) continue;

      if (allow.largeFiles.has(rel)) allowlisted.push({ file: rel, lines });
      else offenders.push({ file: rel, lines });
    }

    if (allowlisted.length) {
      // eslint-disable-next-line no-console
      console.warn(
        `code_quality: allowlisted large files (${allowlisted.length}):\n` +
          allowlisted
            .sort((a, b) => b.lines - a.lines)
            .map((o) => `- ${o.file} (${o.lines} lines)`)
            .join("\n"),
      );
    }

    if (offenders.length) {
      throw new Error(
        [
          "",
          "================================================================================",
          "CODE QUALITY GATE FAILED: LARGE FILES",
          "================================================================================",
          "",
          `src/**/*.{ts,tsx} must be <= ${SRC_MAX_LINES} lines (allowlist supported).`,
          "",
          ...offenders
            .sort((a, b) => b.lines - a.lines)
            .map((o) => `- ${o.file} (${o.lines} lines)`),
          "",
          "To fix:",
          "- Refactor the file to split into smaller modules/components, OR",
          "- Add a temporary allowlist entry in tests/code_quality/allow.json under large_files",
          "================================================================================",
        ].join("\n"),
      );
    }
  });

  it("enforces function complexity with allowlist", () => {
    const root = repoRootFromHere();
    const allow = readAllowlist(root);

    const COMPLEXITY_MAX = 40;

    const eslintArgs = [
      "exec",
      "eslint",
      "src/**/*.{ts,tsx}",
      "--quiet",
      "--format",
      "json",
      "--rule",
      `complexity: ["error", ${COMPLEXITY_MAX}]`,
    ];

    const res = spawnSync("pnpm", eslintArgs, {
      cwd: root,
      encoding: "utf8",
      stdio: "pipe",
      env: process.env,
    });

    const raw = (res.stdout ?? "").trim();
    if (!raw) {
      // If eslint output is empty, we treat it as pass.
      // Non-zero exit codes still matter, but only for complexity errors.
      if (res.status === 0) return;
      throw new Error(
        `Complexity check failed to produce JSON output (exit ${res.status ?? "unknown"})`,
      );
    }

    let parsed: Array<{
      filePath: string;
      messages: Array<{ ruleId: string | null; message: string }>;
    }>;
    try {
      parsed = JSON.parse(raw) as typeof parsed;
    } catch (err) {
      throw new Error(
        `Complexity check produced invalid JSON (exit ${res.status ?? "unknown"}): ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const offenders: Array<{ file: string; fn: string; msg: string }> = [];
    const allowlisted: Array<{ file: string; fn: string; msg: string }> = [];

    for (const fileRes of parsed) {
      const rel = posixRel(root, fileRes.filePath);
      for (const m of fileRes.messages) {
        if (m.ruleId !== "complexity") continue;

        const match = /Function '([^']+)'/.exec(m.message);
        const fnName = match?.[1] ?? "<unknown>";
        const key = `${rel}::${fnName}`;

        if (allow.complexity.has(key))
          allowlisted.push({ file: rel, fn: fnName, msg: m.message });
        else offenders.push({ file: rel, fn: fnName, msg: m.message });
      }
    }

    if (allowlisted.length) {
      // eslint-disable-next-line no-console
      console.warn(
        `code_quality: allowlisted complexity offenders (${allowlisted.length}):\n` +
          allowlisted
            .sort(
              (a, b) =>
                a.file.localeCompare(b.file) || a.fn.localeCompare(b.fn),
            )
            .map((o) => `- ${o.file} :: ${o.fn} (${o.msg})`)
            .join("\n"),
      );
    }

    if (offenders.length) {
      throw new Error(
        [
          "",
          "================================================================================",
          "CODE QUALITY GATE FAILED: COMPLEXITY",
          "================================================================================",
          "",
          `ESLint complexity threshold exceeded (max ${COMPLEXITY_MAX}).`,
          "",
          ...offenders
            .sort(
              (a, b) =>
                a.file.localeCompare(b.file) || a.fn.localeCompare(b.fn),
            )
            .map((o) => `- ${o.file} :: ${o.fn} (${o.msg})`),
          "",
          "To fix:",
          "- Refactor to reduce branching, OR",
          "- Add a temporary allowlist entry in tests/code_quality/allow.json under complexity",
          "================================================================================",
        ].join("\n"),
      );
    }

    // If eslint exits non-zero but all complexity issues were allowlisted, we still pass.
  }, 30_000);
});
