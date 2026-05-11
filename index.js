const core = require('@actions/core')
const github = require('@actions/github')
const semver = require('semver')
const { getConfig } = require('./config')
const {
    extractPRNumber,
    searchPRByCommit,
    fetchPR,
    getReleaseType,
    getReleaseNotes,
} = require('./pr')
const { createRelease, getCurrentVersion } = require('./version')

// Returns true if the current context looks like an active PR.
function isActivePR() {
    return github.context.eventName === 'pull_request' && github.context.payload.pull_request !== undefined
}

// Returns true if the current context looks like a merge commit.
function isMergeCommit() {
    return github.context.eventName === 'push' && github.context.payload.head_commit !== undefined
}

// Ensures that the currently active PR contains the required release metadata.
async function validateActivePR(config) {
    if (!isActivePR()) {
        core.warning("in 'validate' mode, but this doesn't look like an active PR event (is your workflow misconfigured?)")
        return
    }

    let pr
    try {
        pr = await fetchPR(github.context.payload.pull_request.number, config)
    } catch (e) {
        core.setFailed(e.message)
        return
    }

    let releaseType
    let releaseNotes
    try {
        releaseType = getReleaseType(pr, config)
        releaseNotes = getReleaseNotes(pr, config)
    } catch (e) {
        core.setFailed(`PR validation failed: ${e.message}`)
        return
    }

    const currentVersion = await getCurrentVersion(config)
    const newVersion = semver.inc(currentVersion, releaseType)

    core.info(`current version: ${config.v}${currentVersion}`)
    core.info(`next version: ${config.v}${newVersion}`)
    core.info(`release notes:\n${releaseNotes}`)

    core.setOutput('old-version', `${config.v}${currentVersion}`)
    core.setOutput('version', `${config.v}${newVersion}`)
    core.setOutput('release-notes', releaseNotes)
}

// Increments the version according to the release type and tags a new version with release notes.
async function bumpAndTagNewVersion(config) {
    if (!isMergeCommit()) {
        core.warning("in 'bump' mode, but this doesn't look like a PR merge commit event (is your workflow misconfigured?)")
        return
    }

    const num = extractPRNumber(github.context.payload.head_commit.message)
    let pr
    if (num == null) {
        core.info('Unable to determine PR from commit msg, searching for PR by SHA')
        try {
            pr = await searchPRByCommit(process.env.GITHUB_SHA, config)
        } catch (e) {
            core.setFailed(e.message)
            return
        }
        if (pr == null) {
            // No associated PR (e.g. an initial commit, or a direct push). Skip
            // gracefully rather than failing the job; this matches issue #27.
            core.warning("head commit doesn't look like a PR merge, skipping version bumping and tagging")
            return
        }
    } else {
        try {
            pr = await fetchPR(num, config)
        } catch (e) {
            core.setFailed(e.message)
            return
        }
    }
    core.info(`Processing version bump for PR request #${pr.number}`)

    let releaseType
    let releaseNotes
    try {
        releaseType = getReleaseType(pr, config)
        if (releaseType !== 'skip') {
            releaseNotes = getReleaseNotes(pr, config)
        }
    } catch (e) {
        core.setFailed(`PR validation failed: ${e.message}`)
        return
    }

    const currentVersion = await getCurrentVersion(config)
    if (releaseType !== 'skip') {
        const newVersion = semver.inc(currentVersion, releaseType)
        const newTag = await createRelease(newVersion, releaseNotes, config)
        core.info(`Created release tag ${newTag} with the following release notes:\n${releaseNotes}\n`)

        core.setOutput('version', newTag)
        core.setOutput('release-notes', releaseNotes)
    }
    core.setOutput('old-version', `${config.v}${currentVersion}`)
    core.setOutput('skipped', String(releaseType === 'skip'))
}

async function run() {
    try {
        const config = getConfig()
        if (config.mode === 'validate') {
            await validateActivePR(config)
        } else if (config.mode === 'bump') {
            await bumpAndTagNewVersion(config)
        }
    } catch (e) {
        core.info(e.stack)
        core.setFailed(`unexpected error: ${e.message}`)
    }
}

run()
