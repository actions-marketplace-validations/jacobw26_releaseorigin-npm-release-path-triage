# Changelog

All notable changes to the ReleaseOrigin npm Release Path Triage Action are
recorded here. The project follows semantic versioning from version 1.0.0
onward.

## 1.0.0

- Added dependency-free Node 24 classification of one public npm package as
  `TOKEN`, `OIDC`, `STAGED`, or `UNKNOWN`.
- Added exact-host, fixed-path npm/GitHub/GitLab/CircleCI inspection with manual
  redirect refusal, byte/time/request limits, and no credential input.
- Added minimized Action outputs and Markdown job-summary evidence.
- Added adversarial tests for path construction, streamed size limits,
  redirect handling, multiple release paths, Markdown injection, secret-value
  exclusion, and deterministic source/bundle parity.
