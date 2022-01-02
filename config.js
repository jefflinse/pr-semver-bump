const core = require('@actions/core')
const github = require('@actions/github')

// Gets and validates the 'initial-version' input
function getInitialVersion() {
    const initialVersion = core.getInput('initial-version')
    if (initialVersion === undefined || initialVersion === '') {
        return undefined
    }

    const match = initialVersion.match(/^v?(\d+\.\d+\.\d+)$/)
    if (match) {
        return match[1]
    }

    throw new Error('initial-version must be in one of the following forms: X.Y.Z or vX.Y.Z')
}

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

    return {
        initialVersion: getInitialVersion(),
        mode: mode,
        octokit: github.getOctokit(token),
        releaseLabels: releaseLabels,
        releaseNotesPrefixPattern: releaseNotesPrefixPattern,
        releaseNotesSuffixPattern: releaseNotesSuffixPattern,
        requireReleaseNotes: core.getInput('require-release-notes').toLowerCase() === 'true',
        v: core.getInput('with-v').toLowerCase() === 'true' ? 'v' : '',
    }
}

exports.getConfig = getConfig
