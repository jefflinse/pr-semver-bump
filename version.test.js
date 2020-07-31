const { getCurrentVersion, createRelease } = require('./version');

test('can get the current version when verion tags are available', async () => {
    process.env['GITHUB_REPOSITORY'] = 'mockUser/mockRepo'
    const config = { octokit: { git: {
        listMatchingRefs: async () => {
            return { data: [
                { ref: 'refs/tags/v1.2.3' },
                { ref: 'refs/tags/myFeature' },
                { ref: 'refs/tags/v1.4.0' },
                { ref: 'refs/tags/not-a-version' },
                { ref: 'refs/tags/v1.4.1' },
                { ref: 'refs/tags/very-good-tag' },
            ]}
        }
    }}}

    expect(getCurrentVersion(config)).resolves.toBe('1.4.1')
})

test('returns a default version when verion tags are unavailable', async () => {
    process.env['GITHUB_REPOSITORY'] = 'mockUser/mockRepo'
    const config = { octokit: { git: {
        listMatchingRefs: async () => {
            return { data: [
                { ref: 'refs/tags/myFeature' },
                { ref: 'refs/tags/not-a-version' },
                { ref: 'refs/tags/very-good-tag' },
            ]}
        }
    }}}

    expect(getCurrentVersion(config)).resolves.toBe('0.0.0')
})

test('can create a new release', async () => {
    process.env['GITHUB_REPOSITORY'] = 'mockUser/mockRepo'
    const config = {
        octokit: { git: {
            createTag: async () => {
                return { data: { sha: 'mockSha' } }
            },
            createRef: async () => { return {} },
        }},
    }

    config.v = ''
    expect(createRelease('1.2.3', config)).resolves.toBe('1.2.3')
    config.v = 'v'
    expect(createRelease('1.2.3', config)).resolves.toBe('v1.2.3')
})