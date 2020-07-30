# pr-semver-bump

![GitHub Workflow Status](https://img.shields.io/github/workflow/status/jefflinse/pr-semver-bump/CI)
![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/jefflinse/pr-semver-bump?sort=semver)
![GitHub tag (latest SemVer)](https://img.shields.io/github/v/tag/jefflinse/pr-semver-bump)
![GitHub](https://img.shields.io/github/license/jefflinse/pr-semver-bump)

A GitHub Action to bump and tag a new [semantic version](https://semver.org) when a pull request is merged.

- [Motivation](#motivation)
- [Usage](#usage)
  - [Validation Mode](#validation-mode)
  - [Bump Mode](#bump-mode)
- [Inputs](#inputs)
  - [Using Custom Label Names](#using-custom-label-names)
  - [Requiring Release Notes](#requiring-release-notes)
  - [Constraining Release Notes](#constraining-release-notes)
- [Outputs](#outputs)
- [Full Example](#full-example)
- [Contributing](#contributing)

## Motivation

Many version bumping workflows rely on the presense of special keywords in commit messages to determine which version part to bump (major, minor, or patch). This can be confusing and error-prone.

**This action shifts that responsibility to the pull request level**, enabling developers to specify the release type using a PR label and enter release notes directly in the PR description.

## Usage

This action decides which part of your repo's version to automatically bump based on how the PR is/was labeled. Additionally, it will annotate the tagged version with any release notes found in the PR description.

This action can run in one of two modes: `validate` and `bump`. Regardless of mode, the action will deliberately fail if:

- the pull request is not labeled with an appropriate release label;
- the pull request is labeled with more than one release label;
- `require-release-info` is true, and no release info is found in the pull request description.

### Validation Mode

Run with `mode: validate` as a gate for pull requests to ensure they are appropriately labeled and contain any necessary release notes.

```yaml
name: Release Info
on:
  pull_request:
    types: [labeled, unlabeled, opened, edited, reopened, synchronize, ready_for_review]
jobs:
  check-pr:
    name: Validate PR Release Label and Notes
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: jefflinse/pr-semver-bump@v1
        name: Validate PR Metadata
        with:
          mode: validate
          repo-token: ${{ secrets.GITHUB_TOKEN }}
```

The outputs from this action are:

- `old-version`: The current version
- `version`: The version that will come next
- `release-notes`: The release notes detected

### Bump Mode

Run with `mode: bump` when a pull request merges to master to automatically bump the version and tag a new release.

```yaml
name: Master CI
on:
  push:
    branches:
      - master
jobs:
  bump-tag-version:
    name: Bump and Tag Version
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: jefflinse/pr-semver-bump@v1
        name: Bump and Tag Version
        with:
          mode: bump
          repo-token: ${{ secrets.GITHUB_TOKEN }}
```

The outputs from this action are:

- `old-version`: The previous version
- `version`: The newly tagged version
- `release-notes`: The release notes used in the tag

## Inputs

Inputs can be used to customize the behavior of the action in both modes.

| Name | Description |
| ---- | ----------- |
| `mode` | ***Required.*** Either `validate` or `bump`. |
| `repo-token` | ***Required.*** The `GITHUB_TOKEN` for the repo. Needed for fetching pull request data and tagging new releases. |
| `major-label` | The name of the label that indicates the pull request should result in a **major** version bump. _Default: 'major release'_. |
| `minor-label` | The name of the label that indicates the pull request should result in a **minor** version bump. _Default: 'minor release'_. |
| `patch-label` | The name of the label that indicates the pull request should result in a **patch** version bump. _Default: 'patch release'_. |
| `require-release-notes` | Whether or not release notes are required. |
| `release-notes-prefix` | If defined, constrains release notes to any text appearing after this pattern in the pull request body. By default, release notes start at the beginning of the PR description. |
| `release-notes-suffix` | If defined, constrains release notes to any text appearing before this pattern in the pull request body. By default, release notes end at the end of the PR description. |
| `with-v` | If true, newly tagged versions will be prefixed with 'v', e.g. 'v1.2.3'. |

### Using Custom Label Names

By default, the action expects pull requests to be labeled with one of the following labels to indicate the nature of the release: `major release`, `minor release`, or `patch release`.

You can override these defaults according to your own preferences. For example, if you always use minor releases for features and patch releases for bugs, you might want:

```yaml
uses: jefflinse/pr-semver-bump
name: Validate PR Metadata
with:
  mode: validate
  repo-token: ${{ secrets.GITHUB_TOKEN }}
  minor-label: new-feature
  patch-label: bug-fix
```

### Requiring Release Notes

Setting `require-release-notes: true` in your workflow configuration will require that some sort of release notes be present.

```yaml
uses: jefflinse/pr-semver-bump
name: Validate PR Metadata
with:
  mode: validate
  repo-token: ${{ secrets.GITHUB_TOKEN }}
  require-release-notes: true
```

### Constraining Release Notes

By default, the entire pull request description is used as the release notes. If you want to constrain the release notes to just a subset of the description, you can define `release-notes-prefix` and/or `release-notes-suffix` as bounding patterns for the release notes. Text appearing before the prefix or after the suffix will be ignored.

```yaml
uses: jefflinse/pr-semver-bump
  name: Validate PR Metadata
  with:
    mode: validate
    repo-token: ${{ secrets.GITHUB_TOKEN }}
    release-notes-prefix: -- begin release notes --
    release-notes-suffix: -- end release notes --
```

With the above configuration, a pull request description might look something like this:

>## Summary
>
>This fixes a bug in the thing that isn't working properly.
>
>-- begin release notes --
>
>Multiple bug fixes
>
> - fixes the part where the thing was wrong
> - resolves the situation with the problem
>
>-- end release notes --
>
>## Additional Info
>
>This is all very important additional info.

and the resulting release notes would contain:

>Multiple bug fixes
>
> - fixes the part where the thing was wrong
> - resolves the situation with the problem
>

## Outputs

The following outputs are available regardless of the mode in which the action is run:

| Name | Description |
| ---- | ----------- |
| `old-version` | The version before bumping. |
| `version` | The version after bumping. |
| `release-notes` | Release notes found in the pull request description. |

## Full Example

Create a PR-validation workflow to run whenever a pull request is created or updated. All optional inputs are explicitly set to their default values in the configuration below.

_.github/workflows/**pr.yml**:_

```yaml
name: Release Info
on:
  pull_request:
    types: [labeled, unlabeled, opened, edited, reopened, synchronize, ready_for_review]
jobs:
  check-pr:
    name: Validate PR Release Label and Notes
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: jefflinse/pr-semver-bumpv1
        name: Validate PR Metadata
        with:
          mode: validate
          repo-token: ${{ secrets.GITHUB_TOKEN }}
          major-label: major release
          minor-label: minor release
          patch-label: patch release
          require-release-notes: true
          release-notes-prefix: ''
          release-notes-suffix: ''
          with-v: false
```

Create a CI workflow to run whenever a pull request is merged. All optional inputs are explicitly set to their default values in the configuration below.

_.github/workflows/**ci.yml**:_

```yaml
name: Master CI
on:
  push:
    branches:
      - master
jobs:
  bump-tag-version:
    name: Bump and Tag Version
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: jefflinse/pr-semver-bump@v1
        name: Bump and Tag Version
        with:
          mode: bump
          repo-token: ${{ secrets.GITHUB_TOKEN }}
          major-label: major release
          minor-label: minor release
          patch-label: patch release
          require-release-notes: true
          release-notes-prefix: ''
          release-notes-suffix: ''
          with-v: false
```
