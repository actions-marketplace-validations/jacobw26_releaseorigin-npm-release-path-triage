"use strict";
/* eslint-disable @typescript-eslint/no-require-imports -- The packaged Action is intentionally CommonJS. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const action = require("../src/index.js");

const fixture = (name) => fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8");
const json = (value, init = {}) => new Response(JSON.stringify(value), {
  status: init.status || 200,
  headers: { "content-type": "application/json", ...(init.headers || {}) }
});
const workflowResponse = (text) => json({ type: "file", encoding: "base64", size: Buffer.byteLength(text), content: Buffer.from(text).toString("base64") });

function githubFetch(workflow, seen = []) {
  return async (url, options) => {
    seen.push({ url, options });
    if (url === "https://registry.npmjs.org/example-package/latest") {
      return json({ name: "example-package", version: "1.2.3", repository: { url: "git+https://github.com/acme/example-package.git" }, dist: {} });
    }
    if (url === "https://registry.npmjs.org/example-package") {
      return json({ name: "example-package", time: { "1.2.3": "2026-08-01T00:00:00.000Z" } });
    }
    if (url.endsWith("/contents/.github/workflows")) {
      return json([{ type: "file", name: "release.yml", path: ".github/workflows/release.yml" }]);
    }
    if (url.endsWith("/contents/.github/workflows/release.yml")) return workflowResponse(workflow);
    if (url.endsWith("/contents/.circleci/config.yml")) return json({}, { status: 404 });
    throw new Error(`Unexpected URL: ${url}`);
  };
}

test("accepts exact package names and rejects URLs, commands, and uppercase input", () => {
  assert.equal(action.parsePackageName("@scope/pkg").name, "@scope/pkg");
  for (const bad of ["HTTPS://npmjs.com/pkg", "Pkg", "npm install pkg", "../pkg", "@scope", ""]) {
    assert.throws(() => action.parsePackageName(bad), action.InputError);
  }
});

test("accepts only canonical npm-declared GitHub or GitLab repositories", () => {
  assert.deepEqual(action.parseDeclaredRepository("git+https://github.com/acme/pkg.git"), {
    provider: "github", projectPath: "acme/pkg", publicUrl: "https://github.com/acme/pkg"
  });
  assert.equal(action.parseDeclaredRepository("https://example.com/acme/pkg"), null);
  assert.equal(action.parseDeclaredRepository("https://github.com/acme/pkg?redirect=https://evil.example"), null);
  assert.equal(action.parseDeclaredRepository("https://api.github.com/repos/acme/pkg"), null);
});

test("classifies TOKEN, OIDC, STAGED, and UNKNOWN conservatively", () => {
  const token = action.classifyWorkflowDocuments([fixture("token.yml")], "github");
  assert.equal(token.classification, "TOKEN");
  assert.deepEqual(token.tokenEnvironmentNames, ["NODE_AUTH_TOKEN", "NPM_TOKEN"]);
  assert.equal(action.classifyWorkflowDocuments([fixture("oidc.yml")], "github").classification, "OIDC");
  assert.equal(action.classifyWorkflowDocuments([fixture("staged.yml")], "gitlab").classification, "STAGED");
  assert.equal(action.classifyWorkflowDocuments([fixture("unknown.yml")], "github").classification, "UNKNOWN");

  const mixed = action.classifyWorkflowDocuments([`${fixture("token.yml")}\npermissions:\n  id-token: write`], "github");
  assert.equal(mixed.classification, "UNKNOWN");
  assert.equal(mixed.reason, "mixed-token-and-id-token-signals-in-same-file");
});

test("does not correlate authentication signals across separate workflow files", () => {
  const unauthenticatedPublish = "jobs:\n  release:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm publish\n";
  const unrelatedToken = "jobs:\n  test:\n    runs-on: ubuntu-latest\n    env:\n      NPM_TOKEN: placeholder\n    steps:\n      - run: npm test\n";
  const unrelatedOidc = "permissions:\n  id-token: write\njobs:\n  attest:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n";
  const tokenResult = action.classifyWorkflowDocuments([unauthenticatedPublish, unrelatedToken], "github");
  const oidcResult = action.classifyWorkflowDocuments([unauthenticatedPublish, unrelatedOidc], "github");
  assert.equal(tokenResult.classification, "UNKNOWN");
  assert.equal(tokenResult.reason, "production-publish-authentication-not-determinable");
  assert.equal(oidcResult.classification, "UNKNOWN");
  assert.equal(oidcResult.reason, "production-publish-authentication-not-determinable");
  assert.equal(tokenResult.filesInspected, 2);
});

test("treats an authenticated path plus a second ambiguous publish path as multiple paths", () => {
  const ambiguousPublish = "jobs:\n  release-two:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm publish\n";
  const result = action.classifyWorkflowDocuments([fixture("token.yml"), ambiguousPublish], "github");
  assert.equal(result.classification, "UNKNOWN");
  assert.equal(result.reason, "multiple-visible-production-paths");
  assert.deepEqual(result.visibleProductionPublishCommands, ["npm-publish"]);
});

test("triage uses fixed allowlisted endpoints, rejects redirects, and emits minimized evidence", async () => {
  const seen = [];
  const result = await action.triagePackage("example-package", { fetchImpl: githubFetch(fixture("token.yml"), seen), now: Date.UTC(2026, 8, 4) });
  assert.equal(result.classification, "TOKEN");
  assert.equal(result.version, "1.2.3");
  assert.deepEqual(result.inspectedWorkflowFiles, ["release.yml"]);
  assert.deepEqual(result.tokenEnvironmentNames, ["NODE_AUTH_TOKEN", "NPM_TOKEN"]);
  assert.equal(result.publishedAt, "2026-08-01T00:00:00.000Z");
  assert.ok(seen.every(({ url }) => ["registry.npmjs.org", "api.github.com"].includes(new URL(url).hostname)));
  assert.ok(seen.every(({ options }) => options.redirect === "manual" && !Object.keys(options.headers).some((key) => /authorization/i.test(key))));
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /super-secret-value/);

  await assert.rejects(
    action.fetchJsonBounded("https://registry.npmjs.org/pkg/latest", "registry.npmjs.org", 1000, async () => new Response("", { status: 302, headers: { location: "https://evil.example" } })),
    /unexpected redirect/
  );
  await assert.rejects(
    action.fetchJsonBounded("https://evil.example/pkg", "registry.npmjs.org", 1000, async () => json({})),
    /destination was refused/
  );
});

test("enforces the streamed response limit even without a content-length header", async () => {
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"padding":"'));
      controller.enqueue(new TextEncoder().encode("x".repeat(2_000)));
      controller.enqueue(new TextEncoder().encode('"}'));
      controller.close();
    }
  });
  await assert.rejects(
    action.fetchJsonBounded("https://registry.npmjs.org/pkg/latest", "registry.npmjs.org", 128, async () => new Response(body, {
      status: 200,
      headers: { "content-type": "application/json" }
    })),
    /response limit/
  );
});

test("refuses traversal-like workflow listings and never turns them into requests", async () => {
  const seen = [];
  const fetchImpl = async (url, options) => {
    seen.push({ url, options });
    if (url === "https://registry.npmjs.org/example-package/latest") {
      return json({ name: "example-package", version: "1.2.3", repository: "https://github.com/acme/example-package", dist: {} });
    }
    if (url === "https://registry.npmjs.org/example-package") return json({ name: "example-package", time: {} });
    if (url.endsWith("/contents/.github/workflows")) {
      return json([
        { type: "file", name: "../../evil.yml", path: ".github/workflows/../../evil.yml" },
        { type: "file", name: "safe.yml", path: ".github/workflows/../../evil.yml" },
        { type: "file", name: "release.yml", path: ".github/workflows/release.yml" }
      ]);
    }
    if (url.endsWith("/contents/.github/workflows/release.yml")) return workflowResponse(fixture("token.yml"));
    if (url.endsWith("/contents/.circleci/config.yml")) return json({}, { status: 404 });
    throw new Error(`Unexpected URL: ${url}`);
  };
  const result = await action.triagePackage("example-package", { fetchImpl });
  assert.equal(result.classification, "TOKEN");
  assert.deepEqual(result.inspectedWorkflowFiles, ["release.yml"]);
  assert.ok(seen.every(({ url }) => !url.includes("evil")));
  assert.ok(seen.every(({ options }) => !Object.keys(options.headers).some((key) => /authorization/i.test(key))));
});

test("oversized workflow content is contained as UNKNOWN and never returned", async () => {
  const oversized = "x".repeat(action.LIMITS.workflowBytes + 1);
  const result = await action.triagePackage("example-package", { fetchImpl: githubFetch(oversized) });
  assert.equal(result.classification, "UNKNOWN");
  assert.equal(result.unavailableFiles, 1);
  assert.doesNotMatch(JSON.stringify(result), /x{100}/);
});

test("rejects registry version text that could inject Markdown or output syntax", async () => {
  const fetchImpl = async (url) => {
    if (url === "https://registry.npmjs.org/example-package/latest") {
      return json({ name: "example-package", version: "1.2.3` | [click](https://evil.example)", repository: null, dist: {} });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };
  await assert.rejects(action.triagePackage("example-package", { fetchImpl }), /invalid current version/);
});

test("prioritizes a release workflow even when more than twelve safe candidates are listed", async () => {
  const seen = [];
  const generic = Array.from({ length: 12 }, (_, index) => ({
    type: "file",
    name: `check-${String(index).padStart(2, "0")}.yml`,
    path: `.github/workflows/check-${String(index).padStart(2, "0")}.yml`
  }));
  const fetchImpl = async (url, options) => {
    seen.push({ url, options });
    if (url === "https://registry.npmjs.org/example-package/latest") {
      return json({ name: "example-package", version: "1.2.3", repository: "https://github.com/acme/example-package", dist: {} });
    }
    if (url === "https://registry.npmjs.org/example-package") return json({ name: "example-package", time: {} });
    if (url.endsWith("/contents/.github/workflows")) {
      return json([...generic, { type: "file", name: "npm-release.yml", path: ".github/workflows/npm-release.yml" }]);
    }
    if (url.endsWith("/contents/.github/workflows/npm-release.yml")) return workflowResponse(fixture("oidc.yml"));
    if (url.includes("/contents/.github/workflows/check-")) return workflowResponse(fixture("unknown.yml"));
    if (url.endsWith("/contents/.circleci/config.yml")) return json({}, { status: 404 });
    throw new Error(`Unexpected URL: ${url}`);
  };
  const result = await action.triagePackage("example-package", { fetchImpl });
  assert.equal(result.classification, "OIDC");
  assert.deepEqual(result.inspectedWorkflowFiles, ["npm-release.yml", "check-00.yml", "check-01.yml"]);
  assert.ok(seen.every(({ url }) => ["registry.npmjs.org", "api.github.com"].includes(new URL(url).hostname)));
});

test("action runner writes outputs and a Markdown step summary without workflow bodies", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "releaseorigin-action-"));
  const outputFile = path.join(directory, "output.txt");
  const summaryFile = path.join(directory, "summary.md");
  const outcome = await action.runAction({ INPUT_PACKAGE: "example-package", GITHUB_OUTPUT: outputFile, GITHUB_STEP_SUMMARY: summaryFile }, githubFetch(fixture("oidc.yml")));
  assert.equal(outcome.ok, true);
  assert.equal(outcome.result.classification, "OIDC");
  const outputs = fs.readFileSync(outputFile, "utf8");
  const summary = fs.readFileSync(summaryFile, "utf8");
  assert.match(outputs, /classification<<releaseorigin_/);
  assert.match(outputs, /\nOIDC\n/);
  assert.match(summary, /ReleaseOrigin public release-path triage/);
  assert.match(summary, /\*\*OIDC\*\*/);
  assert.match(summary, /optional \*\*\$149 Release-Path Rescue/);
  assert.doesNotMatch(`${outputs}\n${summary}`, /id-token:\s*write/);
});

test("missing required input fails explicitly", async () => {
  const outcome = await action.runAction({}, async () => { throw new Error("must not fetch"); });
  assert.equal(outcome.ok, false);
  assert.match(outcome.error, /exact npm package name/i);
});
