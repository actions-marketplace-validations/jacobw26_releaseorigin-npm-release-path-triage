# ReleaseOrigin npm Release Path Triage

A free, dependency-free GitHub JavaScript Action that examines bounded **public** metadata for one npm package and reports `TOKEN`, `OIDC`, `STAGED`, or `UNKNOWN`.

## What it does

The action reads the package's latest public npm metadata, follows only a canonical GitHub or GitLab repository declared by that metadata, and inspects a small set of fixed public CI paths. It writes a minimized evidence table to the GitHub job summary.

It never:

- installs, downloads, imports, executes, builds, or publishes the package;
- accepts a URL, repository, token, workflow path, or command as input;
- sends credentials or an `Authorization` header;
- follows an HTTP redirect;
- fetches package tarballs, release assets, or arbitrary URLs;
- stores analytics, leads, workflow bodies, secret values, or maintainer identities.

## Usage

The example pins the reviewed v1.0.1 metadata-fix commit:

```yaml
name: Inspect public npm release path

on:
  workflow_dispatch:

permissions:
  contents: read

jobs:
  triage:
    runs-on: ubuntu-latest
    steps:
      - name: Classify the visible release path
        id: releaseorigin
        uses: jacobw26/releaseorigin-npm-release-path-triage@c98d805c9595df14b20b698083209640b1f41261
        with:
          package: '@scope/package-name'

      - name: Use the bounded result
        env:
          CLASSIFICATION: ${{ steps.releaseorigin.outputs.classification }}
          REASON: ${{ steps.releaseorigin.outputs.reason }}
        run: printf '%s (%s)\n' "$CLASSIFICATION" "$REASON"
```

When upgrading, review the source and resolved commit, then replace the SHA deliberately. GitHub identifies a full commit SHA as the only immutable way to consume an action.

## Input

| Name | Required | Description |
| --- | --- | --- |
| `package` | Yes | Exact lowercase npm package name such as `package-name` or `@scope/package-name`. URLs and commands are rejected. |

## Outputs

| Name | Description |
| --- | --- |
| `classification` | `TOKEN`, `OIDC`, `STAGED`, or `UNKNOWN`. |
| `reason` | Stable machine-readable reason for the result. |
| `package-version` | Latest public npm version observed. |
| `repository-provider` | `github`, `gitlab`, or `none`. |
| `workflow-files-inspected` | JSON array of public file names inspected. |
| `evidence-summary` | Minimized Markdown also appended to `$GITHUB_STEP_SUMMARY`. |

## Classification boundaries

- `TOKEN`: one sampled public workflow file contains both a visible production publish command and a token-like **environment variable name**, with no visible ID-token signal.
- `OIDC`: one sampled public workflow file contains both a visible production publish command and an ID-token signal, with no token-like variable name.
- `STAGED`: an exact visible `npm stage publish` or `npm publish --stage` command appears.
- `UNKNOWN`: evidence is missing, ambiguous, mixed, oversized, unavailable, or shows multiple production paths.

These are static observations, not findings. Authentication signals are correlated only at the workflow-file level, not proven to apply to the same job or runtime command. The action does not establish which workflow runs in production, whether a token contains a value, whether trusted publishing is configured, whether a runner is eligible, or whether a release is secure or compliant. Missing attestation metadata is not treated as proof of a problem.

The classifier examines at most three prioritized `.github/workflows/*.yml|yaml` files, the fixed `.gitlab-ci.yml` path, and the fixed `.circleci/config.yml` path. It limits each workflow to 160 KB, repository API responses to 750 KB, npm latest metadata to 1 MB, packuments to 6.5 MB, and requests to eight seconds. All requests use HTTPS, an exact host allowlist, and manual redirect handling.

## Network and permissions

No GitHub token, npm token, secret, checkout, or write permission is required. Requests can go only to:

- `registry.npmjs.org` for fixed package metadata paths;
- `api.github.com` for fixed content paths derived from a package-declared public GitHub repository;
- `gitlab.com` for fixed API paths derived from a package-declared public GitLab repository.

The example declares `contents: read` as a conservative job-level permission. The action does not read the caller's repository or use `GITHUB_TOKEN`. Public API rate limits and availability still apply; uncertainty returns `UNKNOWN` rather than a guessed classification.

## Local development

Requires Node.js 24 or newer and has zero package dependencies.

```bash
npm ci --ignore-scripts
npm test
npm run build
npm run build:check
```

`dist/index.js` is committed because GitHub executes the packaged file. `npm run build:check` fails if it differs from `src/index.js`.

Local verification receipt (September 4, 2026): `npm test` passed 14/14 tests, including the metadata-scalar and source/bundle parity checks. This dated local result does not attest to a later GitHub-hosted run, Marketplace review, or consumer workflow.

## Optional human next step

The summary links to an optional [$149 ReleaseOrigin Release-Path Rescue](https://releaseorigin.pages.dev) with a 24-hour target after fit, public inputs, and payment. That is human-reviewed and never automatically purchased or started by the action. The action itself is free and works without the service.

See [PRIVACY.md](PRIVACY.md), [SECURITY.md](SECURITY.md),
[SUPPORT.md](SUPPORT.md), [CONTRIBUTING.md](CONTRIBUTING.md),
[CHANGELOG.md](CHANGELOG.md), and [PUBLISHING.md](PUBLISHING.md).

## License

MIT
