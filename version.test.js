/* eslint-disable no-undef */
const { getCurrentVersion, createRelease } = require('./version')

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

const baseBranchCases = [
    [
        {
            matchingRefs: [
                {
                    ref: 'refs/tags/v1.2.3',
                    object: {
                        type: 'commit',
                        sha: 'mockCommit1',
                    },
                },
                {
                    ref: 'refs/tags/myFeature',
                },
                {
                    ref: 'refs/tags/v1.4.0',
                    object: {
                        type: 'commit',
                        sha: 'mockCommit2',
                    },
                },
                {
                    ref: 'refs/tags/not-a-version',
                },
                {
                    ref: 'refs/tags/v1.4.1',
                    object: {
                        type: 'tag',
                    },
                },
                {
                    ref: 'refs/tags/very-good-tag',
                },
            ],
            getTagSha: 'mockCommit3',
            commitsOnBranch: [
                { sha: 'mockCommit1' },
                { sha: 'mockCommit2' },
            ],
        },
        '1.4.0',
    ],
    [
        {
            matchingRefs: [
                {
                    ref: 'refs/tags/v1.2.3',
                    object: {
                        type: 'commit',
                        sha: 'mockCommit1',
                    },
                },
                {
                    ref: 'refs/tags/v1.4.0',
                    object: {
                        type: 'tag',
                    },
                },
                {
                    ref: 'refs/tags/v1.4.1',
                    object: {
                        type: 'commit',
                        sha: 'mockCommit3',
                    },
                },
            ],
            getTagSha: 'mockCommit2',
            commitsOnBranch: [
                { sha: 'mockCommit1' },
                { sha: 'mockCommit2' },
            ],
        },
        '1.4.0',
    ],
    [
        {
            matchingRefs: [
                {
                    ref: 'refs/tags/v1.2.3',
                    object: {
                        type: 'commit',
                        sha: 'mockCommit3',
                    },
                },
            ],
            commitsOnBranch: [
                { sha: 'mockCommit1' },
                { sha: 'mockCommit2' },
            ],
        },
        '0.0.0',
    ],
]

test.each(baseBranchCases)('returns the latest version on a branch', async (input, expected) => {
    process.env['GITHUB_REPOSITORY'] = 'mockUser/mockRepo'
    process.env['GITHUB_REF'] = 'refs/heads/mockBranch'

    async function* asyncGenerator(fn) {
        yield fn()
    }
    const config = {
        baseBranch: true,
        octokit: {
            git: {
                listMatchingRefs: async () => ({
                    data: input.matchingRefs,
                }),
            },
            paginate: {
                iterator: asyncGenerator,
            },
            rest: {
                git: {
                    getTag: async () => ({
                        data: {
                            object: {
                                sha: input.getTagSha,
                            },
                        },
                    }),
                },
                repos: {
                    listCommits: async () => ({
                        data: input.commitsOnBranch,
                    }),
                },
            },
        },
    }

    return expect(getCurrentVersion(config)).resolves.toBe(expected)
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
