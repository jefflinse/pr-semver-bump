const core = require('@actions/core');
const github = require('@actions/github')
const semver = require('semver')

var config = getConfig()

async function run() {
    try {
        if (config.mode === 'validate') {
            await validateActivePR()
        } else if (config.mode === 'bump') {
            await bumpAndTagNewVersion()
        }
    } catch (e) {
        core.setFailed(`unexpected error: ${e.message}`)
    }
}

// Gets all the required inputs and validates them before proceeding.
function getConfig() {
    const mode = core.getInput('mode', {required: true}).toLowerCase()
    if (mode !== 'validate' && mode !== 'bump') {
        core.setFailed("mode must be either 'validate' or 'bump'")
    }

    const releaseNotesPrefix = core.getInput('release-notes-prefix')
    const releaseNotesSuffix = core.getInput('release-notes-suffix')

    var releaseLabels = {}
    releaseLabels[core.getInput('major-label')] = 'major'
    releaseLabels[core.getInput('minor-label')] = 'minor'
    releaseLabels[core.getInput('patch-label')] = 'patch'

    return {
        mode: mode,
        releaseLabels: releaseLabels,
        releaseNotesRegex: new RegExp(`${releaseNotesPrefix}([\\s\\S]*)${releaseNotesSuffix}`),
        requireReleaseNotes: core.getInput('require-release-notes').toLowerCase() === 'true',
        v: core.getInput('with-v').toLowerCase() === 'true' ? 'v' : '',
    }
}

// Ensures that the currently active PR contains the required release metadata.
async function validateActivePR() {
    if (!isActivePR()) {
        core.warning(`in 'validate' mode, but this doesn't look like an active PR event (is your workflow misconfigured?)`)
        return
    }

    var pr
    try {
        pr = await fetchPR(github.context.payload.pull_request.number)
    } catch (e) {
        core.setFailed(`failed to fetch PR data: ${e.message}`)
        return
    }

    var releaseType, releaseNotes
    try {
        releaseType = getReleaseType(pr)
        releaseNotes = getReleaseNotes(pr)
    } catch (e) {
        core.setFailed(`PR validation failed: ${e.message}`)
        return
    }

    const currentVersion = await getCurrentVersion()
    const newVersion = semver.inc(currentVersion, releaseType)

    core.info(`current version: ${config.v}${currentVersion}`)
    core.info(`next version: ${config.v}${newVersion}`)
    core.info(`release notes:\n${releaseNotes}`)

    core.setOutput('oldversion', `${config.v}${currentVersion}`)
    core.setOutput('version', `${config.v}${newVersion}`)
    core.setOutput('releasenotes', releaseNotes)

    return
}

// Increments the version according to the release type and tags a new version with release notes.
async function bumpAndTagNewVersion() {
    if (!isMergeCommit()) {
        core.warning(`in 'bump' mode, but this doesn't look like a PR merge commit event (is your workflow misconfigured?)`)
        return
    }

    const num = extractPRNumber(github.context.payload.head_commit.message)
    if (num === null) {
        // Don't want to fail the job if some other commit comes in, but let's warn about it.
        // Might be a good point for configuration in the future.
        core.warning(`head commit doesn't look like a PR merge, skipping version bumping and tagging`)
        return
    }

    const pr = await fetchPR(num)
    const releaseType = getReleaseType(pr)
    const releaseNotes = getReleaseNotes(pr)
    const currentVersion = await getCurrentVersion()

    const newVersion = semver.inc(currentVersion, releaseType)
    const newTag = await createRelease(newVersion, releaseNotes)

    core.setOutput('oldversion', `${config.v}${currentVersion}`)
    core.setOutput('version', newTag)
    core.setOutput('releasenotes', releaseNotes)

    return
}

// Returns true if the current context looks like an active PR.
function isActivePR() {
    return github.context.eventName === 'pull_request' && github.context.payload.pull_request !== undefined
}

// Returns true if the current context looks like a merge commit.
function isMergeCommit() {
    return github.context.eventName === 'push' && github.context.payload.head_commit !== undefined
}

// Returns the PR number from a commit message, or null if one can't be found.
function extractPRNumber(commitMsg) {
    const re = /Merge pull request #(\d+) from/
    const matches = commitMsg.match(re)
    if (matches !== null && matches.length > 1) {
        return matches[1].trim()
    }

    return null
}

// Fetch the details of a pull request.
async function fetchPR(num) {
    try {
        const data = await octokit().pulls.get({
            ...github.context.repo,
            pull_number: num
        })

        return data.data
    }
    catch (fetchError) {
        throw new Error(`failed to fetch data for PR #${num}: ${fetchError.message}`)
    }
}

// Retuns the release type (major, minor, or patch) based on the tags in the PR.
function getReleaseType(pr) {
    const labelNames = pr.labels.map(label => label.name)
    const releaseLabelsPresent = labelNames.filter(name => Object.keys(config.releaseLabels).includes(name))
    if (releaseLabelsPresent.length === 0) {
        throw new Error('no release label specified on PR')
    } else if (releaseLabelsPresent.length > 1) {
        throw new Error(`too many release labels specified on PR: ${releaseLabelsPresent}`)
    }

    return config.releaseLabels[releaseLabelsPresent[0]]
}

// Extracts the release notes from the PR body.
function getReleaseNotes(pr) {
    var notes = ''
    if (pr.body !== null && pr.body !== '') {
        const matches = pr.body.match(config.releaseNotesRegex)
        if (matches !== null && matches.length > 1) {
            notes = matches[1].trim()
        }
    }

    if (notes === ''  && config.requireReleaseNotes) {
        throw new Error('missing release notes')
    }

    return notes
}

// Returns the most recent tagged version in git.
async function getCurrentVersion() {
    const data = await octokit().git.listMatchingRefs({
        ...github.context.repo,
        namespace: 'tags/'
    })
    
    const versions = data.data
        .map(ref => semver.parse(ref.ref.replace(/^refs\/tags\//g, ''), { loose: true }))
        .filter(version => version !== null)
        .sort(semver.rcompare)
    
    return versions[0] || semver.parse('v0.0.0')
}

// Tags the specified version and annotates it with the provided release notes.
async function createRelease(version, releaseNotes) {
    const tag = `${config.v}${version}`
    core.info(`Creating release tag ${tag} with the following release notes:\n${releaseNotes}\n`)
    const tagCreateResponse = await octokit().git.createTag({
        ...github.context.repo,
        tag: version,
        message: releaseNotes,
        object: process.env.GITHUB_SHA,
        type: 'commit',
    })

    await octokit().git.createRef({
        ...github.context.repo,
        ref: `refs/tags/${version}`,
        sha: tagCreateResponse.data.sha,
    })

    return tag
}

// Return an instance of octokit using the user-supplied access token.
function octokit() {
    const token = core.getInput('repo-token', {required: true})
    core.setSecret(token)
    return github.getOctokit(token)
}

run();
