# Security Policy

## Supported versions

| Version line | Supported          |
|--------------|--------------------|
| `v1.x`       | :white_check_mark: |
| `< v1.0`     | :x:                |

The `v1` floating tag always points at the latest `v1.x.y` release. Pinning
to `@v1` is the recommended way to receive security fixes automatically.

## Reporting a vulnerability

Please **do not** open a public issue for security-sensitive reports.

Instead, use GitHub's private vulnerability reporting:

1. Go to the [Security tab](https://github.com/jefflinse/pr-semver-bump/security)
   of this repository.
2. Click **Report a vulnerability**.
3. Provide as much detail as possible: reproduction, affected versions, and
   any suggested mitigations.

You can expect an initial response within 7 days. Confirmed issues will be
fixed as soon as practical and disclosed publicly after a fix ships.

## Scope

This action runs in the context of the consuming repository's GitHub Actions
runner and uses the `GITHUB_TOKEN` provided by the workflow. It does not
make outbound calls to any third-party service. The action's blast radius is
limited to the permissions granted to its `repo-token` input — see the
[Permissions section of the README](README.md#permissions).
