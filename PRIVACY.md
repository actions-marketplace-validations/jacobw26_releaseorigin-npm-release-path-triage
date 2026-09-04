# Privacy and data boundary

ReleaseOrigin npm Release Path Triage runs inside the caller's GitHub Actions runner. It has no telemetry, database, tracking pixel, lead form, remote ReleaseOrigin API call, or credential input.

It sends bounded unauthenticated HTTPS requests directly from the runner to npm's public registry and, only when declared in npm metadata, GitHub's or GitLab's public repository API. Those providers can process normal request metadata such as the runner IP address and user agent under their own policies.

The action writes only minimized observations to its outputs, log notice, and job summary: package name/version, canonical public repository URL, inspected file names, classification/reason enums, publish-command family enums, token **variable names**, booleans, and boundary language. It does not write workflow bodies, token values, credentials, package contents, event payloads, or maintainer identities.

GitHub controls retention and access for workflow logs and job summaries. Repository owners should configure their retention and access policies appropriately.
