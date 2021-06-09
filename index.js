const core = require('@actions/core')
const github = require('@actions/github')
const semver = require('semver')
const { getConfig } = require('./config')
const { extractPRNumber, searchPRByCommit, fetchPR, getReleaseType, getReleaseNotes } = require("./pr")
const { createRelease, getCurrentVersion } = require("./version")

async function run() {
    try {
        let config = getConfig()
        if (config.mode === 'validate') {
            await validateActivePR(config)
        } else if (config.mode === 'bump') {
            await bumpAndTagNewVersion(config)
        }
    } catch (e) {
        core.setFailed(`unexpected error: ${e.message}`)
    }
}

// Ensures that the currently active PR contains the required release metadata.
async function validateActivePR(config) {
    if (!isActivePR()) {
        core.warning(`in 'validate' mode, but this doesn't look like an active PR event (is your workflow misconfigured?)`)
        return
    }

    let pr
    try {
        pr = await fetchPR(github.context.payload.pull_request.number, config)
    } catch (e) {
        core.setFailed(e.message)
        return
    }

    let releaseType, releaseNotes
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
        core.warning(`in 'bump' mode, but this doesn't look like a PR merge commit event (is your workflow misconfigured?)`)
        return
    }

    let num = extractPRNumber(github.context.payload.head_commit.message)
    let pr
    if (num == null) {
        core.info("Unable to determine PR from commit msg, searching for PR by SHA") 
        // Try to search the commit sha for the PR number
        pr = await searchPRByCommit(process.env.GITHUB_SHA, config)
        if(pr == null ) {
            // Don't want to fail the job if some other commit comes in, but let's warn about it.
            // Might be a good point for configuration in the future.
            core.warning(`head commit doesn't look like a PR merge, skipping version bumping and tagging`)
            return
        }
    }
    else {
        pr = await fetchPR(num, config)
    }
    core.info(`Processing version bump for PR request #${pr.number}`) 
    const releaseType = getReleaseType(pr, config)
    const releaseNotes = getReleaseNotes(pr, config)
    const currentVersion = await getCurrentVersion(config)

    const newVersion = semver.inc(currentVersion, releaseType)
    const newTag = await createRelease(newVersion, releaseNotes, config)
    core.info(`Created release tag ${newTag} with the following release notes:\n${releaseNotes}\n`)

    core.setOutput('old-version', `${config.v}${currentVersion}`)
    core.setOutput('version', newTag)
    core.setOutput('release-notes', releaseNotes)
}

// Returns true if the current context looks like an active PR.
function isActivePR() {
    return github.context.eventName === 'pull_request' && github.context.payload.pull_request !== undefined
}

// Returns true if the current context looks like a merge commit.
function isMergeCommit() {
    return github.context.eventName === 'push' && github.context.payload.head_commit !== undefined
}

run()
