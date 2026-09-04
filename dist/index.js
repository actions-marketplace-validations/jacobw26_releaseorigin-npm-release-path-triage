// Generated from src/index.js by npm run build. Do not edit dist directly.
"use strict";
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS is intentional for a portable packaged JavaScript Action. */

const fs = require("node:fs");
const { randomUUID } = require("node:crypto");

const LIMITS = Object.freeze({
  latestBytes: 1_000_000,
  packumentBytes: 6_500_000,
  repositoryBytes: 750_000,
  workflowBytes: 160_000,
  workflowDocuments: 4,
  githubWorkflowCandidates: 1_000,
  githubWorkflowFiles: 3,
  timeoutMs: 8_000
});

const HOSTS = Object.freeze({
  registry: "registry.npmjs.org",
  githubApi: "api.github.com",
  gitlab: "gitlab.com"
});

class InputError extends Error {}
class UpstreamError extends Error {}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clean(value, maximum = 160) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function cleanVersion(value) {
  const version = clean(value, 80);
  if (!/^[0-9A-Za-z][0-9A-Za-z.+-]{0,79}$/.test(version)) {
    throw new UpstreamError("The npm registry returned an invalid current version.");
  }
  return version;
}

function parsePackageName(value) {
  if (typeof value !== "string") throw new InputError("Provide an exact npm package name.");
  const name = value.trim();
  if (!name || name.length > 214 || name !== name.toLowerCase() || /[\u0000-\u0020\u007f]/.test(name)) {
    throw new InputError("Use an exact lowercase npm package name, such as package-name or @scope/package-name.");
  }
  const segment = "[a-z0-9](?:[a-z0-9._~-]{0,212}[a-z0-9._~-])?";
  if (!new RegExp(`^(?:${segment}|@${segment}/${segment})$`).test(name) || name === "." || name === "..") {
    throw new InputError("The package input must be a package name, not a URL, command, or file path.");
  }
  return { name, encoded: encodeURIComponent(name), registryPage: `https://www.npmjs.com/package/${name}` };
}

function repositorySegments(pathname) {
  const value = pathname.replace(/^\/+|\/+$/g, "").replace(/\.git$/i, "");
  if (!value || value.includes("%")) return null;
  const segments = value.split("/");
  if (segments.some((part) => !/^[a-z0-9_.-]+$/i.test(part) || part === "." || part === "..")) return null;
  return segments;
}

function parseDeclaredRepository(repository) {
  let value = typeof repository === "string" ? repository : repository?.url;
  if (typeof value !== "string") return null;
  value = value.trim();
  if (!value || value.length > 500 || /[\u0000-\u001f\u007f]/.test(value)) return null;

  const shorthand = value.match(/^(github|gitlab):([a-z0-9_.-]+(?:\/[a-z0-9_.-]+){1,7})$/i);
  if (shorthand) value = `https://${shorthand[1].toLowerCase()}.com/${shorthand[2]}`;
  const scp = value.match(/^git@(github\.com|gitlab\.com):([a-z0-9_.-]+(?:\/[a-z0-9_.-]+){1,7})(?:\.git)?$/i);
  if (scp) value = `https://${scp[1].toLowerCase()}/${scp[2]}`;
  value = value.replace(/^git\+/, "");

  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (!new Set(["github.com", "gitlab.com"]).has(host)) return null;
  if (!new Set(["https:", "git:", "ssh:"]).has(url.protocol) || url.password || url.port || url.search || url.hash) return null;
  if (url.username && !(url.protocol === "ssh:" && url.username === "git")) return null;
  const segments = repositorySegments(url.pathname);
  if (!segments || (host === "github.com" && segments.length !== 2) || (host === "gitlab.com" && (segments.length < 2 || segments.length > 8))) return null;
  const provider = host === "github.com" ? "github" : "gitlab";
  const projectPath = segments.join("/");
  return { provider, projectPath, publicUrl: `https://${host}/${projectPath}` };
}

async function readTextBounded(response, maximumBytes) {
  const declared = Number(response.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > maximumBytes) throw new UpstreamError("A public source exceeded the response limit.");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maximumBytes) {
      await reader.cancel();
      throw new UpstreamError("A public source exceeded the response limit.");
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

async function fetchJsonBounded(url, allowedHost, maximumBytes, fetchImpl, headers = {}) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.hostname !== allowedHost || parsed.username || parsed.password || parsed.port || parsed.hash) {
    throw new UpstreamError("A public-source destination was refused.");
  }
  let response;
  try {
    response = await fetchImpl(parsed.href, {
      method: "GET",
      redirect: "manual",
      headers: { Accept: "application/json", ...headers },
      signal: AbortSignal.timeout(LIMITS.timeoutMs)
    });
  } catch {
    throw new UpstreamError("A public source could not be reached.");
  }
  if (response.status === 404) return { status: 404, data: null };
  if (response.status >= 300 && response.status < 400) throw new UpstreamError("A public source returned an unexpected redirect.");
  if (!response.ok) throw new UpstreamError("A public source returned an unexpected response.");
  if (!(response.headers.get("content-type") || "").toLowerCase().includes("json")) {
    throw new UpstreamError("A public source did not return JSON.");
  }
  const text = await readTextBounded(response, maximumBytes);
  try {
    return { status: response.status, data: JSON.parse(text) };
  } catch {
    throw new UpstreamError("A public source returned invalid JSON.");
  }
}

function summarizeAttestations(document) {
  const metadata = document?.dist?.attestations;
  const values = Array.isArray(metadata) ? metadata : isRecord(metadata) ? Object.values(metadata) : [];
  return {
    present: Boolean(isRecord(metadata) && Object.keys(metadata).length > 0) || Array.isArray(metadata) && metadata.length > 0,
    provenancePredicatePresent: Boolean(metadata?.provenance || values.some((item) => clean(item?.predicateType, 200).toLowerCase().includes("provenance")))
  };
}

function safeWorkflowEntries(data) {
  if (!Array.isArray(data)) return [];
  return data
    .filter((item) => item?.type === "file" || item?.type === "blob" || item?.type === undefined)
    .map((item) => ({ name: clean(item?.name, 120), path: clean(item?.path, 300) }))
    .filter(({ name, path }) => /^[a-z0-9][a-z0-9_. -]{0,114}\.(?:yml|yaml)$/i.test(name) && !name.includes("..") && (!path || path === `.github/workflows/${name}`))
    .slice(0, LIMITS.githubWorkflowCandidates);
}

function prioritizeWorkflows(entries) {
  const priority = (name) => /(?:^|[-_.])(?:npm|packages?|release)(?:[-_.]|$)/i.test(name) ? 0
    : /(?:^|[-_.])publish(?:[-_.]|$)/i.test(name) ? 1
      : /(?:^|[-_.])deploy(?:[-_.]|$)/i.test(name) ? 2 : 3;
  return [...entries].sort((a, b) => priority(a.name) - priority(b.name) || a.name.localeCompare(b.name)).slice(0, LIMITS.githubWorkflowFiles);
}

function decodeWorkflow(data) {
  if (!isRecord(data) || (data.type && !new Set(["file", "blob"]).has(data.type))) throw new UpstreamError("Public workflow metadata was not a file.");
  const declared = Number(data.size || 0);
  if (Number.isFinite(declared) && declared > LIMITS.workflowBytes) throw new UpstreamError("A public workflow file exceeded the response limit.");
  if (data.encoding !== "base64" || typeof data.content !== "string") throw new UpstreamError("Public workflow content was unavailable.");
  const encoded = data.content.replace(/\s+/g, "");
  if (!/^[a-z0-9+/]*={0,2}$/i.test(encoded) || encoded.length > Math.ceil(LIMITS.workflowBytes / 3) * 4 + 8) {
    throw new UpstreamError("Public workflow content was invalid or oversized.");
  }
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.byteLength > LIMITS.workflowBytes) throw new UpstreamError("A public workflow file exceeded the response limit.");
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function commandFragments(workflow) {
  const fragments = [];
  let blockIndent = null;
  for (const line of workflow.split(/\r?\n/)) {
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const indent = line.match(/^\s*/)[0].length;
    if (blockIndent !== null && indent <= blockIndent) blockIndent = null;
    const block = line.match(/^(\s*)(?:-\s*)?(?:run|script|command)\s*:\s*(?:[>|][-+]?)?\s*(?:#.*)?$/i);
    if (block) {
      blockIndent = block[1].length;
      continue;
    }
    const inline = line.match(/^\s*(?:-\s*)?(?:run|script|command|publish)\s*:\s*(.+)$/i);
    if (inline) fragments.push(inline[1].trim());
    else if (blockIndent !== null && indent > blockIndent) fragments.push(line.trim().replace(/^-\s*/, ""));
  }
  return fragments.filter((fragment) => fragment && !/^(?:echo|printf)\b/i.test(fragment));
}

function tokenEnvironmentNames(workflow) {
  const names = new Set();
  const tokenName = (name) => /^[A-Z][A-Z0-9_]{1,63}$/.test(name)
    && (((/(?:NPM|NODE|YARN)/.test(name)) && /(?:TOKEN|AUTH)/.test(name)) || (/(?:PUBLISH|RELEASE)/.test(name) && /TOKEN/.test(name)));
  for (const line of workflow.split(/\r?\n/)) {
    if (/^\s*#/.test(line)) continue;
    const key = line.match(/^\s*(?:-\s*)?([A-Z][A-Z0-9_]{1,63})\s*:/)?.[1];
    if (key && tokenName(key)) names.add(key);
    for (const pattern of [/(?:secrets|vars)\.([A-Z][A-Z0-9_]{1,63})/g, /\$([A-Z][A-Z0-9_]{1,63})\b/g]) {
      for (const match of line.matchAll(pattern)) if (tokenName(match[1])) names.add(match[1]);
    }
  }
  return [...names].sort().slice(0, 12);
}

function visiblePublishSignals(workflow) {
  const signals = new Set();
  let staged = false;
  for (const fragment of commandFragments(workflow)) {
    if (/--dry-run\b/i.test(fragment)) continue;
    if (/\bnpm\s+stage\s+publish\b/i.test(fragment) || /\bnpm\s+publish\b[^\n#]*\s--stage(?:=|\s|$)/i.test(fragment)) {
      staged = true;
      signals.add("npm-staged-publish");
      continue;
    }
    if (/\bnpm\s+publish\b/i.test(fragment)) signals.add("npm-publish");
    if (/\bpnpm\s+(?:--[^\s]+\s+)*publish\b/i.test(fragment)) signals.add("pnpm-publish");
    if (/\byarn\s+npm\s+publish\b/i.test(fragment)) signals.add("yarn-npm-publish");
    if (/\b(?:npx|npm\s+(?:exec|x)|pnpm\s+(?:exec|dlx))\s+(?:changeset|changesets)\s+publish\b/i.test(fragment)) signals.add("changesets-publish");
    if (/\b(?:npx|npm\s+(?:exec|x)|pnpm\s+(?:exec|dlx))\s+lerna\s+publish\b/i.test(fragment)) signals.add("lerna-publish");
    if (/\b(?:npx|npm\s+(?:exec|x)|pnpm\s+(?:exec|dlx))\s+semantic-release\b/i.test(fragment)) signals.add("semantic-release");
    if (!/\b(?:npm|pnpm)\s+publish\b/i.test(fragment)
      && /\b(?:npm|pnpm|yarn)\s+(?:run\s+)?[a-z0-9:_-]*publish[a-z0-9:_-]*\b/i.test(fragment)) signals.add("package-script-publish");
  }
  if (/\buses\s*:\s*changesets\/action@[^\s#]+/i.test(workflow) && /^\s*publish\s*:\s*\S+/im.test(workflow)) signals.add("changesets-action-publish");
  return { signals: [...signals].sort(), staged };
}

function runnerSignal(workflow, provider) {
  if (provider === "gitlab") return "not-determinable-from-public-ci-file";
  if (provider === "circleci") {
    if (/^\s*resource_class\s*:\s*[a-z0-9_.-]+\/[a-z0-9_.-]+\s*(?:#.*)?$/im.test(workflow)) return "self-hosted-runner-signal";
    if (/^\s*(?:docker|machine|macos)\s*:/im.test(workflow)) return "circleci-cloud-executor-signal";
    return "needs-owner-verification";
  }
  const values = [...workflow.matchAll(/^\s*runs-on\s*:\s*(.+)$/gim)].map((match) => match[1].toLowerCase());
  if (values.some((value) => value.includes("self-hosted"))) return "self-hosted-runner-signal";
  if (values.some((value) => /\b(?:ubuntu|windows|macos)-(?:latest|\d[\w.-]*)\b/.test(value))) return "github-hosted-runner-signal";
  return "not-determinable-from-public-workflow";
}

function classifyWorkflowDocument(document, provider, filesInspected) {
  const publish = visiblePublishSignals(document);
  const tokenNames = tokenEnvironmentNames(document);
  const idTokenPermission = /^\s*id-token\s*:\s*write\b/im.test(document) || /^\s*id_tokens\s*:/im.test(document) || /^\s*permissions\s*:\s*write-all\b/im.test(document);
  const oidcEnvironmentSignal = provider === "circleci" && /\bCIRCLE_OIDC_TOKEN(?:_V2)?\b/.test(document);
  const oidc = idTokenPermission || oidcEnvironmentSignal;
  const publishVisible = publish.signals.length > 0;
  let classification = "UNKNOWN";
  let reason = "no-visible-production-publish-command";
  if (publish.staged) {
    classification = "STAGED";
    reason = "visible-npm-staged-publishing-command";
  } else if (publishVisible && tokenNames.length && !oidc) {
    classification = "TOKEN";
    reason = "visible-token-and-production-publish-in-same-file";
  } else if (publishVisible && oidc && !tokenNames.length) {
    classification = "OIDC";
    reason = "visible-id-token-and-production-publish-in-same-file";
  } else if (publishVisible && oidc && tokenNames.length) {
    reason = "mixed-token-and-id-token-signals-in-same-file";
  } else if (publishVisible) {
    reason = "production-publish-authentication-not-determinable";
  }
  return {
    classification,
    reason,
    visibleProductionPublishCommands: publish.signals,
    tokenEnvironmentNames: tokenNames,
    idTokenPermission,
    oidcEnvironmentSignal,
    stagedPublishingCommand: publish.staged,
    provider: provider === "github" ? "github-actions" : provider === "gitlab" ? "gitlab-ci" : "circleci-cloud",
    runnerEligibility: runnerSignal(document, provider),
    filesInspected,
    boundary: "Public workflow text only; authentication signals are correlated at file level, not proven at job or runtime level. This does not establish security, compliance, npm account configuration, or migration eligibility."
  };
}

function classifyWorkflowDocuments(documents, provider) {
  if (!Array.isArray(documents) || documents.length > LIMITS.workflowDocuments || !new Set(["github", "gitlab", "circleci"]).has(provider)) {
    throw new TypeError("A bounded workflow collection and supported provider are required.");
  }
  for (const document of documents) {
    if (typeof document !== "string" || Buffer.byteLength(document, "utf8") > LIMITS.workflowBytes) throw new TypeError("Workflow content is invalid or oversized.");
  }
  if (!documents.length) return classifyWorkflowDocument("", provider, 0);
  const selected = selectClassification(documents.map((document) => classifyWorkflowDocument(document, provider, 1)));
  return { ...selected, filesInspected: documents.length };
}

function selectClassification(classifications) {
  const visiblePaths = classifications.filter((item) => item.visibleProductionPublishCommands.length > 0);
  const actionable = classifications.filter((item) => item.classification !== "UNKNOWN");
  if (visiblePaths.length === 1 && actionable.length === 1) return actionable[0];
  if (visiblePaths.length <= 1 && actionable.length === 0) {
    const evidenceScore = (item) => item.visibleProductionPublishCommands.length * 10
      + item.tokenEnvironmentNames.length
      + Number(item.idTokenPermission || item.oidcEnvironmentSignal);
    return [...classifications].sort((a, b) => evidenceScore(b) - evidenceScore(a))[0];
  }
  return {
    classification: "UNKNOWN",
    reason: "multiple-visible-production-paths",
    visibleProductionPublishCommands: [...new Set(visiblePaths.flatMap((item) => item.visibleProductionPublishCommands))].sort(),
    tokenEnvironmentNames: [...new Set(visiblePaths.flatMap((item) => item.tokenEnvironmentNames))].sort().slice(0, 12),
    idTokenPermission: visiblePaths.some((item) => item.idTokenPermission),
    oidcEnvironmentSignal: visiblePaths.some((item) => item.oidcEnvironmentSignal),
    stagedPublishingCommand: visiblePaths.some((item) => item.stagedPublishingCommand),
    provider: "multiple-public-ci-paths",
    runnerEligibility: "needs-owner-verification",
    filesInspected: classifications.reduce((sum, item) => sum + item.filesInspected, 0),
    boundary: "Multiple public publishing paths are visible; an authorized owner must identify the production path."
  };
}

async function fetchWorkflow(endpoint, host, fetchImpl, headers = {}) {
  try {
    const result = await fetchJsonBounded(endpoint, host, LIMITS.repositoryBytes, fetchImpl, headers);
    if (result.status === 404) return { visible: false, document: null, unavailable: false };
    try {
      return { visible: true, document: decodeWorkflow(result.data), unavailable: false };
    } catch {
      return { visible: true, document: null, unavailable: true };
    }
  } catch {
    return { visible: false, document: null, unavailable: true };
  }
}

async function inspectRepository(repository, fetchImpl) {
  if (repository.provider === "github") {
    const [owner, repo] = repository.projectPath.split("/");
    const base = `https://${HOSTS.githubApi}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents`;
    const headers = { "User-Agent": "ReleaseOrigin-Action/0.1 public-workflow-triage" };
    const listing = await fetchJsonBounded(`${base}/.github/workflows`, HOSTS.githubApi, LIMITS.repositoryBytes, fetchImpl, headers);
    const entries = listing.status === 200 ? safeWorkflowEntries(listing.data) : [];
    const selected = prioritizeWorkflows(entries);
    const documents = [];
    const inspected = [];
    let unavailableFiles = 0;
    for (const entry of selected) {
      const result = await fetchWorkflow(`${base}/.github/workflows/${encodeURIComponent(entry.name)}`, HOSTS.githubApi, fetchImpl, headers);
      inspected.push(entry.name);
      if (result.document) documents.push(result.document);
      if (result.unavailable) unavailableFiles += 1;
    }
    const circle = await fetchWorkflow(`${base}/.circleci/config.yml`, HOSTS.githubApi, fetchImpl, headers);
    const classifications = [classifyWorkflowDocuments(documents, "github")];
    if (circle.visible) {
      inspected.push(".circleci/config.yml");
      classifications.push(classifyWorkflowDocuments(circle.document ? [circle.document] : [], "circleci"));
    }
    if (circle.unavailable) unavailableFiles += 1;
    return { state: entries.length || circle.visible ? "public-workflow-path-visible" : "no-public-workflow-path-returned", inspectedWorkflowFiles: inspected, unavailableFiles, classification: selectClassification(classifications) };
  }

  const project = encodeURIComponent(repository.projectPath);
  const projectResult = await fetchJsonBounded(`https://${HOSTS.gitlab}/api/v4/projects/${project}`, HOSTS.gitlab, LIMITS.repositoryBytes, fetchImpl);
  if (projectResult.status === 404 || projectResult.data?.visibility === "private") {
    return { state: "public-project-metadata-unavailable", inspectedWorkflowFiles: [], unavailableFiles: 0, classification: classifyWorkflowDocuments([], "gitlab") };
  }
  const branch = clean(projectResult.data?.default_branch, 200);
  if (!branch || !/^[a-z0-9._\/-]+$/i.test(branch)) {
    return { state: "default-branch-unavailable", inspectedWorkflowFiles: [], unavailableFiles: 0, classification: classifyWorkflowDocuments([], "gitlab") };
  }
  const base = `https://${HOSTS.gitlab}/api/v4/projects/${project}/repository/files`;
  const gitlab = await fetchWorkflow(`${base}/${encodeURIComponent(".gitlab-ci.yml")}?ref=${encodeURIComponent(branch)}`, HOSTS.gitlab, fetchImpl);
  const circle = await fetchWorkflow(`${base}/${encodeURIComponent(".circleci/config.yml")}?ref=${encodeURIComponent(branch)}`, HOSTS.gitlab, fetchImpl);
  const classifications = [classifyWorkflowDocuments(gitlab.document ? [gitlab.document] : [], "gitlab")];
  const inspected = [];
  if (gitlab.visible) inspected.push(".gitlab-ci.yml");
  if (circle.visible) {
    inspected.push(".circleci/config.yml");
    classifications.push(classifyWorkflowDocuments(circle.document ? [circle.document] : [], "circleci"));
  }
  return { state: inspected.length ? "public-workflow-path-visible" : "no-public-workflow-path-returned", inspectedWorkflowFiles: inspected, unavailableFiles: Number(gitlab.unavailable) + Number(circle.unavailable), classification: selectClassification(classifications) };
}

async function publishedAt(packageName, version, encodedName, fetchImpl) {
  try {
    const result = await fetchJsonBounded(`https://${HOSTS.registry}/${encodedName}`, HOSTS.registry, LIMITS.packumentBytes, fetchImpl);
    if (result.status !== 200 || result.data?.name !== packageName) return null;
    const value = clean(result.data?.time?.[version], 80);
    return value && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : null;
  } catch {
    return null;
  }
}

function unknownClassification(reason, provider = "none") {
  return {
    classification: "UNKNOWN",
    reason,
    visibleProductionPublishCommands: [],
    tokenEnvironmentNames: [],
    idTokenPermission: false,
    oidcEnvironmentSignal: false,
    stagedPublishingCommand: false,
    provider,
    runnerEligibility: "not-determinable",
    filesInspected: 0,
    boundary: "No production authentication conclusion can be made from the bounded public evidence returned."
  };
}

async function triagePackage(packageInput, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") throw new Error("This action requires the Node.js fetch API.");
  const parsed = parsePackageName(packageInput);
  const latestResult = await fetchJsonBounded(`https://${HOSTS.registry}/${parsed.encoded}/latest`, HOSTS.registry, LIMITS.latestBytes, fetchImpl);
  if (latestResult.status === 404) throw new InputError(`The public npm package ${parsed.name} was not found.`);
  const latest = latestResult.data;
  if (!isRecord(latest) || latest.name !== parsed.name) throw new UpstreamError("The npm registry returned mismatched package metadata.");
  const version = cleanVersion(latest.version);
  const repository = parseDeclaredRepository(latest.repository);
  let inspection = { state: "no-supported-public-repository-declared", inspectedWorkflowFiles: [], unavailableFiles: 0, classification: unknownClassification("no-supported-public-repository-declared") };
  if (repository) {
    try {
      inspection = await inspectRepository(repository, fetchImpl);
    } catch {
      inspection = { state: "repository-inspection-temporarily-unavailable", inspectedWorkflowFiles: [], unavailableFiles: 1, classification: unknownClassification("repository-inspection-temporarily-unavailable", repository.provider) };
    }
  }
  return {
    packageName: parsed.name,
    version,
    publishedAt: await publishedAt(parsed.name, version, parsed.encoded, fetchImpl),
    registryPage: parsed.registryPage,
    attestations: summarizeAttestations(latest),
    repository: repository ? { provider: repository.provider, publicUrl: repository.publicUrl } : null,
    state: inspection.state,
    inspectedWorkflowFiles: inspection.inspectedWorkflowFiles,
    unavailableFiles: inspection.unavailableFiles,
    ...inspection.classification,
    checkedAt: new Date(options.now ?? Date.now()).toISOString()
  };
}

function markdownCell(value) {
  return clean(value, 500).replace(/\|/g, "\\|") || "Not observed";
}

function buildEvidenceSummary(result) {
  const files = result.inspectedWorkflowFiles.length ? result.inspectedWorkflowFiles.map((name) => `\`${markdownCell(name)}\``).join(", ") : "None";
  const signals = result.visibleProductionPublishCommands.length ? result.visibleProductionPublishCommands.map((name) => `\`${name}\``).join(", ") : "None";
  const tokenNames = result.tokenEnvironmentNames.length ? result.tokenEnvironmentNames.map((name) => `\`${name}\``).join(", ") : "None";
  return [
    "## ReleaseOrigin public release-path triage",
    "",
    "| Field | Bounded observation |",
    "| --- | --- |",
    `| Package | \`${markdownCell(result.packageName)}@${markdownCell(result.version)}\` |`,
    `| Classification | **${result.classification}** |`,
    `| Reason | \`${markdownCell(result.reason)}\` |`,
    `| Declared repository | ${result.repository ? `[${markdownCell(result.repository.publicUrl)}](${result.repository.publicUrl})` : "No supported public GitHub/GitLab repository declared"} |`,
    `| Public workflow files inspected | ${files} |`,
    `| Visible publish-command families | ${signals} |`,
    `| Token environment names (names only) | ${tokenNames} |`,
    `| ID-token signal | ${result.idTokenPermission || result.oidcEnvironmentSignal ? "Observed" : "Not observed"} |`,
    `| npm attestation metadata | ${result.attestations.present ? "Present" : "Not observed"} |`,
    "",
    "> This is static triage of bounded public metadata, not a security audit or proof of the production release path. It never installs, executes, downloads, or publishes the package.",
    "",
    "If an authorized maintainer wants a human-reviewed migration or unblock, [ReleaseOrigin](https://releaseorigin.pages.dev) offers an optional **$149 Release-Path Rescue with a 24-hour target after fit, public inputs, and payment**. This action does not purchase, submit, or start that service."
  ].join("\n");
}

function workflowEscape(value) {
  return String(value).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}

function appendOutput(file, name, value) {
  if (!file) return;
  const delimiter = `releaseorigin_${randomUUID().replace(/-/g, "")}`;
  fs.appendFileSync(file, `${name}<<${delimiter}\n${String(value)}\n${delimiter}\n`, { encoding: "utf8" });
}

async function runAction(environment = process.env, fetchImpl = globalThis.fetch) {
  try {
    const result = await triagePackage(environment.INPUT_PACKAGE, { fetchImpl });
    const summary = buildEvidenceSummary(result);
    const outputs = {
      classification: result.classification,
      reason: result.reason,
      "package-version": result.version,
      "repository-provider": result.repository?.provider || "none",
      "workflow-files-inspected": JSON.stringify(result.inspectedWorkflowFiles),
      "evidence-summary": summary
    };
    for (const [name, value] of Object.entries(outputs)) appendOutput(environment.GITHUB_OUTPUT, name, value);
    if (environment.GITHUB_STEP_SUMMARY) fs.appendFileSync(environment.GITHUB_STEP_SUMMARY, `${summary}\n`, { encoding: "utf8" });
    process.stdout.write(`::notice title=ReleaseOrigin triage::${workflowEscape(`${result.packageName} is ${result.classification} (${result.reason})`)}\n`);
    return { ok: true, result, summary };
  } catch (error) {
    const message = error instanceof InputError || error instanceof UpstreamError ? error.message : "Release-path triage could not be completed.";
    process.stderr.write(`::error title=ReleaseOrigin triage failed::${workflowEscape(message)}\n`);
    return { ok: false, error: message };
  }
}

module.exports = {
  LIMITS,
  InputError,
  UpstreamError,
  parsePackageName,
  parseDeclaredRepository,
  fetchJsonBounded,
  classifyWorkflowDocuments,
  triagePackage,
  buildEvidenceSummary,
  runAction
};

if (require.main === module) {
  runAction().then((outcome) => {
    if (!outcome.ok) process.exitCode = 1;
  });
}
