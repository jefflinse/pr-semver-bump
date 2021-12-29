/* eslint-disable no-undef */
const { getCurrentVersion, createRelease, getLatestVersionInCommits } = require('./version')

test('can get the current version when verion tags are available', async () => {
    process.env['GITHUB_REPOSITORY'] = 'mockUser/mockRepo'
    const config = {
        octokit: {
            git: {
                listMatchingRefs: async () => ({
                    data: [
                        { ref: 'refs/tags/v1.2.3' },
                        { ref: 'refs/tags/myFeature' },
                        { ref: 'refs/tags/v1.4.0' },
                        { ref: 'refs/tags/not-a-version' },
                        { ref: 'refs/tags/v1.4.1' },
                        { ref: 'refs/tags/very-good-tag' },
                    ],
                }),
            },
        },
    }

    expect(getCurrentVersion(config)).resolves.toBe('1.4.1')
})

test('returns a default version when verion tags are unavailable', async () => {
    process.env['GITHUB_REPOSITORY'] = 'mockUser/mockRepo'
    const config = {
        octokit: {
            git: {
                listMatchingRefs: async () => ({
                    data: [
                        { ref: 'refs/tags/myFeature' },
                        { ref: 'refs/tags/not-a-version' },
                        { ref: 'refs/tags/very-good-tag' },
                    ],
                }),
            },
        },
    }

    expect(getCurrentVersion(config)).resolves.toBe('0.0.0')
})

test('returns the latest version on a branch', async () => {
    const config = {
        octokit: {
            rest: {
                git: {
                    getTag: async () => ({
                        data: {
                            object: {
                                sha: 'mockCommit3',
                            },
                        },
                    }),
                },
            },
        },
    }
    const commits = new Set([
        'mockCommit1',
        'mockCommit2',
    ])
    const sortedVersions = [
        '1.4.1',
        '1.4.0',
        '1.2.3',
    ]
    const objectsByVersion = {
        '1.2.3': {
            type: 'commit',
            sha: 'mockCommit1',
        },
        '1.4.0': {
            type: 'commit',
            sha: 'mockCommit2',
        },
        '1.4.1': {
            type: 'tag',
        },
    }

    return expect(getLatestVersionInCommits(commits, sortedVersions, objectsByVersion, config)).resolves.toBe('1.4.0')
})

test('returns a default version when no tags on the branch', async () => {
    const config = {
        octokit: {
            rest: {
                git: {
                    getTag: async () => ({
                        data: {
                            object: {
                                sha: 'mockCommit5',
                            },
                        },
                    }),
                },
            },
        },
    }
    const commits = new Set([
        'mockCommit1',
        'mockCommit2',
    ])
    const sortedVersions = [
        '1.4.1',
        '1.4.0',
        '1.2.3',
    ]
    const objectsByVersion = {
        '1.2.3': {
            type: 'commit',
            sha: 'mockCommit3',
        },
        '1.4.0': {
            type: 'commit',
            sha: 'mockCommit4',
        },
        '1.4.1': {
            type: 'tag',
        },
    }
    return expect(getLatestVersionInCommits(commits, sortedVersions, objectsByVersion, config)).resolves.toBe('0.0.0')
})

test('can create a new release', async () => {
    process.env['GITHUB_REPOSITORY'] = 'mockUser/mockRepo'
    const config = {
        octokit: {
            git: {
                createTag: async () => ({ data: { sha: 'mockSha' } }),
                createRef: async () => ({}),
            },
        },
    }

    config.v = ''
    expect(createRelease('1.2.3', 'mock release notes', config)).resolves.toBe('1.2.3')
    config.v = 'v'
    expect(createRelease('1.2.3', 'mock release notes', config)).resolves.toBe('v1.2.3')
})
