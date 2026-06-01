# Contributing to pr-semver-bump

Thanks for your interest in contributing! This document covers the basics of
building, testing, and shipping changes to this action.

## Prerequisites

- Node.js (see [`.nvmrc`](.nvmrc) for the required version)
- npm

## Local development

```shell
# Install dependencies
npm ci

# Run the full local check: lint, build, test
npm run all
```

Individual steps:

```shell
npm run lint      # eslint
npm run prepare   # rebuild dist/ using @vercel/ncc
npm run test      # jest with coverage
```

### About `dist/`

This action runs from `dist/index.js`, which is committed to the repo. **If you
change any source file, you must run `npm run prepare` and commit the resulting
`dist/` changes in the same PR.** CI will reject PRs whose `dist/` is out of
sync with source — see `.github/workflows/dist-check.yml`.

## Pull request labeling

Every PR must be labeled with exactly one of:

- `major release` — incompatible API changes
- `minor release` — new functionality, backward-compatible
- `patch release` — bug fixes, backward-compatible

…unless it's a documentation-only or other non-release change, in which case
add a no-op label that matches one configured in the workflow.

PRs that don't have an appropriate label will fail the validation workflow.
The exception is dependabot PRs, which are auto-labeled and exempt from the
validate check.

## Releases

Releases are fully automated:

1. PR is merged to `master`.
2. The `Master CI` workflow runs unit tests.
3. The action bumps the version (using the PR's label) and creates an
   annotated tag (e.g. `v1.7.5`).
4. A GitHub Release is created from the tag's release notes.
5. The floating major-version tag (e.g. `v1`) is advanced to the new commit.

No manual release steps are needed.

## Reporting bugs and security issues

- For bugs, please [open an issue](https://github.com/jefflinse/pr-semver-bump/issues/new).
- For security issues, see [`SECURITY.md`](SECURITY.md).

## A note on forked-PR test runs

By default, GitHub doesn't expose repo secrets to workflows triggered by PRs
from forks. This is by design — but it means the validation workflow can't
run on PRs from forks until a maintainer pushes the branch into this repo.
This is the [GitHub-default behavior](https://docs.github.com/en/actions/security-guides/automatic-token-authentication)
for `GITHUB_TOKEN` on `pull_request` events and isn't something we can or
should change.
