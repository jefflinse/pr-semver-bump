const { extractPRNumber, getReleaseType, getReleaseNotes, fetchPR } = require('./pr');

test('can extract a PR number from a PR merge commit message', () => {
    expect(extractPRNumber('Merge pull request #4 from some/mockBranch')).toEqual('4')
    expect(extractPRNumber('Merge pull request #42 from some/mockBranch')).toEqual('42')
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

test('throws if multiple valud release labels are present', () => {
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

test('can get release notes', async () => {
    const mockPR = {
        body: "this is the body\nbegin notes\nhere are some release notes\nend notes\n"
    }
    const config = {
        releaseNotesRegex: new RegExp('begin notes([\\s\\S]*)end notes'),
        requireReleaseNotes: false,
    }

    const notes = getReleaseNotes(mockPR, config)
    expect(notes).toEqual('here are some release notes')
})

test('returns empty release notes if not required and not found or empty', async () => {
    const bodies = [
        "",
        "this is the body",
        "this is the body\n-begin notes--end notes-\nmore body\n",
        "this is the body\n-begin notes-\n\n\n-end notes-\nmore body\n",
        "this is the body\n-begin notes-      \n   \n  -end notes-\nmore body\n",
    ]
    const config = {
        releaseNotesRegex: new RegExp('-begin notes-([\\s\\S]*)-end notes-'),
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
        "this is the body",
        "this is the body\n-begin notes--end notes-\nmore body\n",
        "this is the body\n-begin notes-\n\n\n-end notes-\nmore body\n",
        "this is the body\n-begin notes-      \n   \n  -end notes-\nmore body\n",
    ]
    const config = {
        releaseNotesRegex: new RegExp('-begin notes-([\\s\\S]*)-end notes-'),
        requireReleaseNotes: true,
    }

    bodies.forEach(body => {
        const mockPR = { body: body }
        expect(() => {
            getReleaseNotes(mockPR, config)
        }).toThrow('missing release notes')
    })
})
