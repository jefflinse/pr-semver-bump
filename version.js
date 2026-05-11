const core = require('@actions/core')
const github = require('@actions/github')
const semver = require('semver')

const DEFAULT_VERSION = '0.0.0'

async function getCommitsOnBranch(branch, config) {
    const commits = new Set()
    // eslint-disable-next-line no-restricted-syntax
    for await (const response of config.octokit.paginate.iterator(
        config.octokit.rest.repos.listCommits,
        {
            ...github.context.repo,
            sha: branch,
        },
    )) {
        response.data.forEach((commit) => {
            commits.add(commit.sha)
        })
    }
    return commits
}

async function getLatestVersionInCommits(commits, sortedVersions, objectsByVersion, config) {
    for (let i = 0; i < sortedVersions.length; i++) {
        const key = sortedVersions[i].version
        const refObj = objectsByVersion[key]

        if (refObj.type === 'commit' && commits.has(refObj.sha)) {
            return key
        }

        if (refObj.type === 'tag') {
            // eslint-disable-next-line no-await-in-loop
            const tag = await config.octokit.rest.git.getTag({
                ...github.context.repo,
                tag_sha: refObj.sha,
            })

            if (commits.has(tag.data.object.sha)) {
                return key
            }
        }
    }

    return DEFAULT_VERSION
}

// Wraps an octokit error with a friendlier message when the failure is due
// to insufficient token permissions.
function wrapPermissionError(err, action) {
    if (err && (err.status === 403 || err.status === 404)) {
        const e = new Error(
            `${action} failed: ${err.message}. `
            + 'This is usually caused by a missing `contents: write` permission '
            + 'on the GITHUB_TOKEN. See README §Permissions.',
        )
        e.status = err.status
        return e
    }
    return err
}

// Tags the specified version and annotates it with the provided release notes.
async function createRelease(version, releaseNotes, config) {
    const tag = `${config.v}${version}`
    let tagCreateResponse
    try {
        tagCreateResponse = await config.octokit.rest.git.createTag({
            ...github.context.repo,
            tag: tag,
            message: releaseNotes,
            object: process.env.GITHUB_SHA,
            type: 'commit',
        })
    } catch (e) {
        throw wrapPermissionError(e, `creating annotated tag ${tag}`)
    }

    try {
        await config.octokit.rest.git.createRef({
            ...github.context.repo,
            ref: `refs/tags/${tag}`,
            sha: tagCreateResponse.data.sha,
        })
    } catch (e) {
        throw wrapPermissionError(e, `creating ref refs/tags/${tag}`)
    }

    return tag
}

// Returns the most recent tagged version in git.
async function getCurrentVersion(config) {
    const objectsByVersion = {}
    const versions = []

    // eslint-disable-next-line no-restricted-syntax
    for await (const response of config.octokit.paginate.iterator(
        config.octokit.rest.git.listMatchingRefs,
        {
            ...github.context.repo,
            ref: 'tags/',
            per_page: 100,
        },
    )) {
        response.data.forEach((ref) => {
            const version = semver.parse(ref.ref.replace(/^refs\/tags\//g, ''), { loose: true })

            if (version !== null) {
                objectsByVersion[version.version] = ref.object
                versions.push(version)
            }
        })
    }

    versions.sort(semver.rcompare)

    if (config.baseBranch) {
        const branch = process.env.GITHUB_BASE_REF || (process.env.GITHUB_REF && process.env.GITHUB_REF.replace('refs/heads/', ''))
        core.info(`Only considering tags on branch ${branch}`)
        const commits = await getCommitsOnBranch(branch, config)
        return getLatestVersionInCommits(commits, versions, objectsByVersion, config)
    }

    if (versions[0] !== undefined) {
        return versions[0].version
    }

    return DEFAULT_VERSION
}

exports.createRelease = createRelease
exports.getCurrentVersion = getCurrentVersion
