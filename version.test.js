/* eslint-disable no-undef */
const { getCurrentVersion, createRelease } = require('./version')

const httpNotFound = 404

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
    expect(createRelease('1.2.3', 'mock release notes', config, false)).resolves.toBe('1.2.3')
    config.v = 'v'
    expect(createRelease('1.2.3', 'mock release notes', config, false)).resolves.toBe('v1.2.3')
})

test('release creation is idempotent if so requested', async () => {
    process.env['GITHUB_REPOSITORY'] = 'mockUser/mockRepo'
    const config = {
        octokit: {
            git: {
                createTag: async () => { throw new Error('createTag unexpectedly called') },
                createRef: async () => { throw new Error('createRef unexpectedly called') },
                getRef: async () => (true),
            },
        },
    }

    config.v = ''
    expect(createRelease('1.2.3', 'mock release notes', config, true)).resolves.toBe('1.2.3')
    config.v = 'v'
    expect(createRelease('1.2.3', 'mock release notes', config, true)).resolves.toBe('v1.2.3')
})

test('release creation always proceeds if tag does not already exist', async () => {
    process.env['GITHUB_REPOSITORY'] = 'mockUser/mockRepo'
    const config = {
        octokit: {
            git: {
                createTag: async () => ({ data: { sha: 'mockSha' } }),
                createRef: async () => ({}),
                getRef: async () => {
                    const err = new Error()
                    err.status = httpNotFound
                    throw err
                },
            },
        },
    }

    config.v = ''
    expect(createRelease('1.2.3', 'mock release notes', config, true)).resolves.toBe('1.2.3')
    config.v = 'v'
    expect(createRelease('1.2.3', 'mock release notes', config, true)).resolves.toBe('v1.2.3')
})

test('release creation fails if getRef fails', async () => {
    const expectedError = new Error()

    process.env['GITHUB_REPOSITORY'] = 'mockUser/mockRepo'
    const config = {
        octokit: {
            git: {
                createTag: async () => { throw new Error('createTag unexpectedly called') },
                createRef: async () => { throw new Error('createRef unexpectedly called') },
                getRef: async () => { throw expectedError },
            },
        },
    }

    config.v = ''
    expect(createRelease('1.2.3', 'mock release notes', config, true)).rejects.toThrow(expectedError)
})
