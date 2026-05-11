/* eslint-disable no-undef */
const { getCurrentVersion, createRelease } = require('./version')

// Build an octokit mock whose paginate.iterator yields one or more pages
// of refs from listMatchingRefs.
function refsOctokit(pages, extra = {}) {
    async function* iterator() {
        for (let i = 0; i < pages.length; i++) {
            yield { data: pages[i] }
        }
    }
    return {
        paginate: { iterator },
        rest: {
            git: {
                listMatchingRefs: async () => ({ data: pages.flat() }),
            },
        },
        ...extra,
    }
}

test('can get the current version when version tags are available', async () => {
    process.env['GITHUB_REPOSITORY'] = 'mockUser/mockRepo'
    const config = {
        octokit: refsOctokit([[
            { ref: 'refs/tags/v1.2.3' },
            { ref: 'refs/tags/myFeature' },
            { ref: 'refs/tags/v1.4.0' },
            { ref: 'refs/tags/not-a-version' },
            { ref: 'refs/tags/v1.4.1' },
            { ref: 'refs/tags/very-good-tag' },
        ]]),
    }

    await expect(getCurrentVersion(config)).resolves.toBe('1.4.1')
})

test('returns a default version when version tags are unavailable', async () => {
    process.env['GITHUB_REPOSITORY'] = 'mockUser/mockRepo'
    const config = {
        octokit: refsOctokit([[
            { ref: 'refs/tags/myFeature' },
            { ref: 'refs/tags/not-a-version' },
            { ref: 'refs/tags/very-good-tag' },
        ]]),
    }

    await expect(getCurrentVersion(config)).resolves.toBe('0.0.0')
})

test('paginates across multiple pages of tags (issue #26)', async () => {
    process.env['GITHUB_REPOSITORY'] = 'mockUser/mockRepo'
    // 3 pages: latest version is on the last page
    const config = {
        octokit: refsOctokit([
            [
                { ref: 'refs/tags/v1.0.0' },
                { ref: 'refs/tags/v1.0.1' },
            ],
            [
                { ref: 'refs/tags/v1.1.0' },
                { ref: 'refs/tags/v1.1.1' },
            ],
            [
                { ref: 'refs/tags/v2.0.0' },
                { ref: 'refs/tags/v2.0.1' },
            ],
        ]),
    }

    await expect(getCurrentVersion(config)).resolves.toBe('2.0.1')
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

    // paginate.iterator is called for both listMatchingRefs and listCommits;
    // the underlying method is passed in, so dispatch on its identity.
    const listMatchingRefs = async () => ({ data: input.matchingRefs })
    const listCommits = async () => ({ data: input.commitsOnBranch })
    const getTag = async () => ({
        data: {
            object: {
                sha: input.getTagSha,
            },
        },
    })

    async function* iterator(method) {
        if (method === listMatchingRefs) {
            yield { data: input.matchingRefs }
        } else if (method === listCommits) {
            yield { data: input.commitsOnBranch }
        }
    }

    const config = {
        baseBranch: true,
        octokit: {
            paginate: { iterator },
            rest: {
                git: { listMatchingRefs, getTag },
                repos: { listCommits },
            },
        },
    }

    return expect(getCurrentVersion(config)).resolves.toBe(expected)
})

test('can create a new release', async () => {
    process.env['GITHUB_REPOSITORY'] = 'mockUser/mockRepo'
    const config = {
        octokit: {
            rest: {
                git: {
                    createTag: async () => ({ data: { sha: 'mockSha' } }),
                    createRef: async () => ({}),
                },
            },
        },
    }

    config.v = ''
    await expect(createRelease('1.2.3', 'mock release notes', config)).resolves.toBe('1.2.3')
    config.v = 'v'
    await expect(createRelease('1.2.3', 'mock release notes', config)).resolves.toBe('v1.2.3')
})

test('createRelease wraps a 403 from createTag with a permissions hint', async () => {
    process.env['GITHUB_REPOSITORY'] = 'mockUser/mockRepo'
    const err = new Error('Resource not accessible by integration')
    err.status = 403
    const config = {
        v: '',
        octokit: {
            rest: {
                git: {
                    createTag: async () => { throw err },
                    createRef: async () => ({}),
                },
            },
        },
    }

    await expect(createRelease('1.2.3', 'notes', config)).rejects.toThrow(/contents: write.*permission/)
})

test('createRelease wraps a 403 from createRef with a permissions hint', async () => {
    process.env['GITHUB_REPOSITORY'] = 'mockUser/mockRepo'
    const err = new Error('Resource not accessible by integration')
    err.status = 403
    const config = {
        v: '',
        octokit: {
            rest: {
                git: {
                    createTag: async () => ({ data: { sha: 'mockSha' } }),
                    createRef: async () => { throw err },
                },
            },
        },
    }

    await expect(createRelease('1.2.3', 'notes', config)).rejects.toThrow(/contents: write.*permission/)
})
