# Owner release and Marketplace checklist

Every tag, release, Marketplace publication, repository transfer, or visibility change affects public consumers. Each action requires a fresh, action-specific confirmation from the repository owner immediately before it occurs.

Local verification receipt (September 4, 2026): `npm test` passed 14/14 tests, including the metadata-scalar guard and `dist/index.js` parity. Re-run the checks against the exact release commit; this dated receipt does not authorize or verify a later release.

1. Confirm the dedicated public repository is `jacobw26/releaseorigin-npm-release-path-triage`, contains only the reviewed bundle, and has `action.yml` at its root.
2. Search GitHub Marketplace and confirm the metadata `name` is still unique; rename it if GitHub reports a collision.
3. Review `LICENSE`, public brand/author details, the optional commercial wording, and all claim boundaries.
4. Enable private vulnerability reporting and branch protection. Keep test workflows unprivileged and secret-free.
5. Run `npm ci --ignore-scripts`, `npm test`, and manually inspect a job summary for disclosure.
6. Review the committed `dist/index.js` and confirm `npm run build:check` passes.
7. In GitHub's official interface, the repository owner personally reviews and accepts the current GitHub Marketplace Terms of Service and Developer Agreement. Do not infer acceptance from an earlier approval or accept for the owner.
8. After a fresh confirmation for the exact tag, commit, release text, categories, repository, and account, create an immutable semantic release such as `v1.0.1`; the owner completes GitHub's required two-factor-authentication publication step personally.
9. Confirm the README example pins the reviewed v1.0.1 metadata-fix commit `c98d805c9595df14b20b698083209640b1f41261` and tells consumers to review and update full commit SHAs deliberately.

Stop if the Marketplace name is unavailable, the metadata preview differs from the reviewed `action.yml`, GitHub changes its platform requirements, the owner has not accepted the current terms, 2FA is unavailable, or the exact action lacks fresh owner confirmation.

Official references:

- https://docs.github.com/en/actions/how-tos/create-and-publish-actions/publish-in-github-marketplace
- https://docs.github.com/en/actions/reference/workflows-and-actions/metadata-syntax
- https://docs.github.com/en/actions/tutorials/create-actions/create-a-javascript-action
- https://docs.github.com/en/actions/reference/security/secure-use
