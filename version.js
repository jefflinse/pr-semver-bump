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
        const refObj = objectsByVersion[sortedVersions[i]]

        if (refObj.type === 'commit' && commits.has(refObj.sha)) {
            return `${sortedVersions[i]}`
        }

        if (refObj.type === 'tag') {
            // eslint-disable-next-line no-await-in-loop
            const tag = await config.octokit.rest.git.getTag({
                ...github.context.repo,
                tag_sha: refObj.sha,
            })

            if (commits.has(tag.data.object.sha)) {
                return `${sortedVersions[i]}`
            }
        }
    }

    return DEFAULT_VERSION
}

// Tags the specified version and annotates it with the provided release notes.
async function createRelease(version, releaseNotes, config) {
    const tag = `${config.v}${version}`
    const tagCreateResponse = await config.octokit.rest.git.createTag({
        ...github.context.repo,
        tag: tag,
        message: releaseNotes,
        object: process.env.GITHUB_SHA,
        type: 'commit',
    })

    await config.octokit.rest.git.createRef({
        ...github.context.repo,
        ref: `refs/tags/${tag}`,
        sha: tagCreateResponse.data.sha,
    })

    return tag
}

// Returns the most recent tagged version in git.
async function getCurrentVersion(config) {
    const data = await config.octokit.rest.git.listMatchingRefs({
        ...github.context.repo,
        ref: 'tags/',
    })

    const objectsByVersion = new Map()
    const versions = []

    data.data.forEach((ref) => {
        const version = semver.parse(ref.ref.replace(/^refs\/tags\//g, ''), { loose: true })

        if (version !== null) {
            objectsByVersion[version] = ref.object
            versions.push(version)
        }
    })

    versions.sort(semver.rcompare)

    if (config.baseBranch) {
        const branch = process.env.GITHUB_BASE_REF || (process.env.GITHUB_REF && process.env.GITHUB_REF.replace('refs/heads/', ''))
        core.info(`Only considering tags on branch ${branch}`)
        const commits = await getCommitsOnBranch(branch, config)
        return getLatestVersionInCommits(commits, versions, objectsByVersion, config)
    }

    if (versions[0] !== undefined) {
        return `${versions[0]}`
    }

    return DEFAULT_VERSION
}

exports.createRelease = createRelease
exports.getCurrentVersion = getCurrentVersion
