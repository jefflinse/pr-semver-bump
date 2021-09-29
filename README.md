# pr-semver-bump

![GitHub Workflow Status](https://img.shields.io/github/workflow/status/jefflinse/pr-semver-bump/CI)
![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/jefflinse/pr-semver-bump?sort=semver)
![GitHub tag (latest SemVer)](https://img.shields.io/github/v/tag/jefflinse/pr-semver-bump)
![GitHub](https://img.shields.io/github/license/jefflinse/pr-semver-bump)

A GitHub Action to bump and tag a new [semantic version](https://semver.org) when a pull request is merged.

A typical workflow using this action is:

1. A developer creates a pull request.
2. The nature of the next version is discussed as part of a code review. A specific tag is applied to the pull request indicating the nature of the changes (e.g. "major", "minor", or "patch").
3. Upon merging the pull request, a new semantic version is tagged automatically. The version number and release notes are determined using the pull request's metadata.

Many [inputs](#inputs) are customizable and the [outputs](#outputs) can be used in downstream steps or jobs. See the [full example](#full-example).

## Motivation

Most version bumping workflows rely on the presense of substrings in commit messages to determine which version part to change (major, minor, or patch). This is often clunky and error-prone.

**This action shifts that responsibility to the pull request level**, allowing developers to specify the next release version using a pull request label and enter release notes directly in the description. These aspects of the release can be discussed alongside the actual code changes.

## Usage

**pr-semver-bump** runs in one of two modes: `validate` and `bump`.

Use **validate** mode as a merge gate for pull requests to ensure they contain the necessary metadata for your next release:

```yaml
name: Release Info
on:
  pull_request:
    types: [labeled, unlabeled, opened, edited, reopened, synchronize, ready_for_review]
jobs:
  check-pr:
    name: Validate Release Label and Notes
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: jefflinse/pr-semver-bump@v1
        name: Validate Pull Request Metadata
        with:
          mode: validate
          repo-token: ${{ secrets.GITHUB_TOKEN }}
```

Use **bump** mode to tag a new release after a pull request actually merges, using that metadata:

```yaml
name: Main CI
on:
  push:
    branches:
      - main
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

The action will fail (in either mode) if any of the following are true:

- the pull request is not labeled with an appropriate release label;
- the pull request is labeled with more than one release label;
- `require-release-info` is true, and no release info is found in the pull request description.

## Inputs

Inputs can be used to customize the behavior of the action in both modes.

| Name | Description |
| ---- | ----------- |
| `mode` | ***Required.*** `validate` or `bump`. |
| `repo-token` | ***Required.*** The `GITHUB_TOKEN` for the repo. Needed for fetching pull request data and tagging new releases. |
| `major-label` | The name of the label that indicates the pull request should result in a **major** version bump. _Default: 'major release'_. |
| `minor-label` | The name of the label that indicates the pull request should result in a **minor** version bump. _Default: 'minor release'_. |
| `patch-label` | The name of the label that indicates the pull request should result in a **patch** version bump. _Default: 'patch release'_. |
| `require-release-notes` | Whether or not release notes are required. |
| `release-notes-prefix` | If defined, constrains release notes to any text appearing after a line matching this pattern in the pull request body. By default, release notes start at the beginning of the pull request description. |
| `release-notes-suffix` | If defined, constrains release notes to any text appearing before a line matching this pattern in the pull request body. By default, release notes end at the end of the pull request description. |
| `with-v` | If true, newly tagged versions will be prefixed with 'v', e.g. 'v1.2.3'. |

### Using Custom Label Names

By default, the action expects pull requests to be [labeled](https://docs.github.com/en/github/managing-your-work-on-github/managing-labels) with one of the following labels to indicate the nature of the release: `major release`, `minor release`, or `patch release`.

You can specify your own labels instead. For example, if you always use minor releases for features and patch releases for bugs, you might want:

```yaml
uses: jefflinse/pr-semver-bump@v1
name: Validate PR Metadata
with:
  mode: validate
  repo-token: ${{ secrets.GITHUB_TOKEN }}
  minor-label: new-feature
  patch-label: bug-fix
```

### Requiring Release Notes

Setting `require-release-notes: true` in your workflow configuration will require that some sort of release notes be present. By default, the entire pull request description is used as release notes.

```yaml
uses: jefflinse/pr-semver-bump@v1
name: Validate PR Metadata
with:
  mode: validate
  repo-token: ${{ secrets.GITHUB_TOKEN }}
  require-release-notes: true
```

### Constraining Release Notes

By default, the entire pull request description is used as the release notes. If you want to constrain the release notes to just a subset of the description, you can define `release-notes-prefix` and/or `release-notes-suffix` as bounding patterns for the release notes. Lines matching these patterns frame the desired release notes. Any text appearing before the prefix pattern or after the suffix pattern will be ignored.

```yaml
uses: jefflinse/pr-semver-bump@v1
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
>This fixs bugs in the thing that isn't working properly.
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

The following outputs are available (in both modes):

| Name | Description |
| ---- | ----------- |
| `old-version` | The version before bumping. |
| `version` | The version after bumping. |
| `release-notes` | Release notes found in the pull request description. |

## Full Example

Create a validation workflow to run whenever a pull request is created or updated. All optional inputs are explicitly set to their default values in the configuration below.

_.github/workflows/**pr.yml**:_

```yaml
name: Release Info
on:
  pull_request:
    types: [labeled, unlabeled, opened, edited, reopened, synchronize, ready_for_review]
jobs:
  check-pr:
    name: Validate Release Label and Notes
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: jefflinse/pr-semver-bump@v1
        name: Validate Pull Request Metadata
        with:
          mode: validate
          repo-token: ${{ secrets.GITHUB_TOKEN }}
          major-label: major release
          minor-label: minor release
          patch-label: patch release
          skip-label: skip release
          require-release-notes: true
          release-notes-prefix: ''
          release-notes-suffix: ''
          with-v: false
```

Create a CI workflow to run whenever a pull request is merged. All optional inputs are explicitly set to their default values in the configuration below.

_.github/workflows/**ci.yml**:_

```yaml
name: Main CI
on:
  push:
    branches:
      - main
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
          skip-label: skip release
          require-release-notes: true
          release-notes-prefix: ''
          release-notes-suffix: ''
          with-v: false
```

## Contributing

This project is actively maintained. Please open an issue if you find a bug, or better yet, submit a pull request :)

### Building

This is a Node.js project. Make sure you have Node and NPM installed, then:

Install dependencies:

```shell
npm i
```

Verify your changes:

```shell
npm run all
```
