const core = require('@actions/core')
const github = require('@actions/github')
const semver = require('semver')

// Gets all the required inputs and validates them before proceeding.
function getConfig() {
    const mode = core.getInput('mode', { required: true }).toLowerCase()
    if (mode !== 'validate' && mode !== 'bump') {
        throw new Error("mode must be either 'validate' or 'bump'")
    }

    const token = core.getInput('repo-token', { required: true })
    core.setSecret(token)

    const releaseNotesPrefix = core.getInput('release-notes-prefix')
    const releaseNotesSuffix = core.getInput('release-notes-suffix')

    let releaseNotesPrefixPattern
    if (releaseNotesPrefix !== undefined && releaseNotesPrefix !== '') {
        releaseNotesPrefixPattern = new RegExp(releaseNotesPrefix)
    }

    let releaseNotesSuffixPattern
    if (releaseNotesSuffix !== undefined && releaseNotesSuffix !== '') {
        releaseNotesSuffixPattern = new RegExp(releaseNotesSuffix)
    }

    const releaseLabels = {}
    releaseLabels[core.getInput('major-label') || 'major release'] = 'major'
    releaseLabels[core.getInput('minor-label') || 'minor release'] = 'minor'
    releaseLabels[core.getInput('patch-label') || 'patch release'] = 'patch'

    const versionInput = core.getInput('version')
    const version = semver.clean(versionInput)
    if (versionInput && !version) {
        throw new Error(`invalid input version: '${versionInput}'`)
    }

    return {
        mode: mode,
        octokit: github.getOctokit(token),
        releaseLabels: releaseLabels,
        releaseNotesPrefixPattern: releaseNotesPrefixPattern,
        releaseNotesSuffixPattern: releaseNotesSuffixPattern,
        requireReleaseNotes: core.getBooleanInput('require-release-notes'),
        v: core.getBooleanInput('with-v') ? 'v' : '',
        dryRun: core.getBooleanInput('dry-run'),
        version: version,
    }
}

exports.getConfig = getConfig
