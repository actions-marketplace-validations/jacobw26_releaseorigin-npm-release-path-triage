# Security policy

## Reporting a vulnerability

Report vulnerabilities through the repository's **Security** tab by selecting **Report a vulnerability**. If private vulnerability reporting is unavailable, open a public issue that requests a private maintainer contact route without including the sensitive details.

Never include credentials, token values, private workflows, customer data, or exploit details that would put users at risk in a public issue. This action is release-path triage, not a security product or audit.

## Design boundary

The action accepts one npm package name and constructs every network destination itself. It uses no credentials, follows no redirects, applies time and byte limits, never evaluates inspected text, and never runs package code. `UNKNOWN` is the required result when evidence is missing or ambiguous.

The output is release-path triage, not vulnerability scanning, compliance validation, provenance verification, or proof of runtime behavior. Reviewers should audit both `src/index.js` and the committed `dist/index.js`; `npm run build:check` verifies source/bundle parity.
