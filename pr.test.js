const { extractPRNumber, getReleaseType, getReleaseNotes, fetchPR } = require('./pr');

test('can extract a PR number from a PR merge commit message', () => {
    expect(extractPRNumber('Merge pull request #4 from some/mockBranch')).toEqual('4')
    expect(extractPRNumber('Merge pull request #42 from some/mockBranch')).toEqual('42')
    expect(extractPRNumber('My PR squashed (#56)')).toEqual('56')
    expect(extractPRNumber('Squash pr (#45)\n\n multiple commit messages appended')).toEqual('45')
})

test('returns null if no PR number is found in a commit message', () => {
    expect(extractPRNumber('Merge branch master into some/mockBranch')).toEqual(null)
})

test('can fetch PR data', async () => {
    process.env['GITHUB_REPOSITORY'] = 'mockUser/mockRepo'
    const config = { octokit: { pulls: {
        get: async (options) => {
            return { data: { number: options.pull_number } }
        }
    }}}

    expect(fetchPR(42, config)).resolves.toEqual({ number: 42 })
})

test('throws when fetching PR data fails', async () => {
    process.env['GITHUB_REPOSITORY'] = 'mockUser/mockRepo'
    const config = { octokit: { pulls: {
        get: async () => {
            throw new Error('mock error')
        }
    }}}

    expect(fetchPR(42, config)).rejects.toThrow('')
})

test('can get release type', () => {
    const mockPR = {
        labels: [
            { name: 'mock-major-label' },
            { name: 'not-release-related' },
            { name: 'another one' },
        ]
    }
    const config = {
        releaseLabels: {
            'mock-major-label': 'major',
            'mock-minor-label': 'minor',
            'mock-patch-label': 'patch',
        },
    }
    
    const type = getReleaseType(mockPR, config)
    expect(type).toEqual('major')
})

test('throws if no valid release label is present', () => {
    const mockPR = {
        labels: [
            { name: 'some-label' },
            { name: 'not-release-related' },
            { name: 'another one' },
        ]
    }
    const config = {
        releaseLabels: {
            'mock-major-label': 'major',
            'mock-minor-label': 'minor',
            'mock-patch-label': 'patch',
        },
    }
    
    expect(() => {
        getReleaseType(mockPR, config)
    }).toThrow('no release label specified on PR')
})

test('throws if multiple valid release labels are present', () => {
    const mockPR = {
        labels: [
            { name: 'mock-major-label' },
            { name: 'not-release-related' },
            { name: 'mock-patch-label' },
        ]
    }
    const config = {
        releaseLabels: {
            'mock-major-label': 'major',
            'mock-minor-label': 'minor',
            'mock-patch-label': 'patch',
        },
    }
    
    expect(() => {
        getReleaseType(mockPR, config)
    }).toThrow('too many release labels specified on PR')
})

describe('can parse release notes', () => {
    const tests = [
        {
            name: "when body is empty",
            body: "",
            before: '',
            after: '',
            expected: "",
        },
        {
            name: "from a single line body",
            body: "a single line body",
            before: '',
            after: '',
            expected: "a single line body",
        },
        {
            name: "from a single line body with surrounding whitespace",
            body: " \t a single line body within whitespace \t ",
            before: '',
            after: '',
            expected: "a single line body within whitespace",
        },
        {
            name: "from a multline body",
            body: "a multiple\nline body with\n\n newlines",
            before: '',
            after: '',
            expected: "a multiple\nline body with\n\n newlines",
        },
        {
            name: "from a multiline body with surrounding whitespace",
            body: " \t\n a multiple\nline body with\n\n newlines within whitespace \t\n ",
            before: '',
            after: '',
            expected: "a multiple\nline body with\n\n newlines within whitespace",
        },
        {
            name: "from a multiline body containing single line notes using a prefix",
            body: "before\n\n--begin--\n\na single line\n\n--end---\n\nafter",
            before: '--begin--',
            after: '',
            expected: "a single line\n\n--end---\n\nafter",
        },
        {
            name: "from a multiline body containing multiline notes using a prefix",
            body: "before\n\n--begin--\n\nmany\ndifferent lines\n\nhere\n\n--end---\n\nafter",
            before: '--begin--',
            after: '',
            expected: "many\ndifferent lines\n\nhere\n\n--end---\n\nafter",
        },
        {
            name: "from a single line body containing single line notes using a prefix and suffix",
            body: "before\n\n--begin--\n\na single line\n\n--end---\n\nafter",
            before: '',
            after: '--end--',
            expected: "before\n\n--begin--\n\na single line",
        },
        {
            name: "",
            body: "before\n\n--begin--\n\nmany\ndifferent lines\n\nhere\n\n--end---\n\nafter",
            before: '',
            after: '--end--',
            expected: "before\n\n--begin--\n\nmany\ndifferent lines\n\nhere",
        },
        {
            name: "",
            body: "before\n\n--begin--\n\na single line\n\n--end---\n\nafter",
            before: '--begin--',
            after: '--end--',
            expected: "a single line",
        },
        {
            name: "with multiline notes from a multiline body using a prefix and suffix",
            body: "before\n\n--begin--\n\nmany\ndifferent lines\n\nhere\n\n--end---\n\nafter",
            before: '--begin--',
            after: '--end--',
            expected: "many\ndifferent lines\n\nhere",
        },
        {
            name: "with multiline notes from a multiline body using line-matching patterns",
            body: "before\n\n--begin--\n\nmany\ndifferent lines\n\nhere\n\n--anything--\n\nafter",
            before: '^--begin--$',
            after: '^--[^-]',
            expected: "many\ndifferent lines\n\nhere",
        },
    ]

    tests.forEach(test => {
        const config = {
            requireReleaseNotes: false,
        }

        if (test.before !== undefined && test.before !== "") {
            config.releaseNotesPrefixPattern = new RegExp(test.before)
        }

        if (test.after !== undefined && test.after !== "") {
            config.releaseNotesSuffixPattern = new RegExp(test.after)
        }

        expect(() => {
            const notes = getReleaseNotes({ body: test.body }, config)
            expect(notes).toBe(test.expected)
        }).not.toThrow()
    })
})

test('returns empty release notes if not required and not found or empty', async () => {
    const bodies = [
        "",
        "--begin--\n--end--",
    ]
    const config = {
        releaseNotesPrefixPattern: new RegExp('--begin--'),
        releaseNotesSuffixPattern: new RegExp('--end--'),
        requireReleaseNotes: false,
    }

    bodies.forEach(body => {
        const mockPR = { body: body }
        const notes = getReleaseNotes(mockPR, config)
        expect(notes).toBe('')
    })
})

test('throws if release notes required but not found or empty', async () => {
    const bodies = [
        "",
        "--begin--\n--end--",
    ]
    const config = {
        releaseNotesPrefixPattern: new RegExp('--begin--'),
        releaseNotesSuffixPattern: new RegExp('--end--'),
        requireReleaseNotes: true,
    }

    bodies.forEach(body => {
        const mockPR = { body: body }
        expect(() => {
            getReleaseNotes(mockPR, config)
        }).toThrow('missing release notes')
    })
})
