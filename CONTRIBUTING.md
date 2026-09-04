# Contributing

ReleaseOrigin accepts narrowly scoped changes that preserve its public-only,
non-executing, bounded release-path triage contract.

Before opening a pull request:

1. Add a synthetic regression for every classifier, URL-construction, size,
   redirect, output, or runner change.
2. Run `npm ci --ignore-scripts` and `npm test`; source and `dist/index.js` must
   remain byte-for-byte equivalent under the checked build.
3. Do not add package installation, tarball download, code execution,
   credentials, arbitrary URLs, private repository access, analytics, or write
   permissions.
4. Keep `UNKNOWN` as the fail-closed result for missing, mixed, ambiguous,
   oversized, unavailable, or multiple-path evidence.
5. Use only synthetic fixtures and public metadata. Never commit a token,
   private workflow, maintainer identity, customer record, or lead.

Report suspected vulnerabilities through the private process in `SECURITY.md`,
not a public issue or pull request.
