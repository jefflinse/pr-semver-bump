/* eslint-disable no-undef */
const process = require('process')
const { getConfig } = require('./config')

test('establishes config from minimum required inputs', () => {
    process.env['INPUT_MODE'] = 'validate'
    process.env['INPUT_REPO-TOKEN'] = 'mockRepoToken'

    const config = getConfig()
    expect(config.mode).toBe('validate')
    expect(config.releaseLabels).toEqual({
        'major release': 'major',
        'minor release': 'minor',
        'patch release': 'patch',
    })
    expect(config.releaseNotesPrefixPattern).toBeUndefined()
    expect(config.releaseNotesSuffixPattern).toBeUndefined()
    expect(config.requireReleaseNotes).toBe(false)
    expect(config.v).toBe('')
    expect(config.dryRun).toBe(false)
    expect(config.version).toBeNull()
    expect(config.octokit).toBeDefined()
    expect(config.octokit).not.toBeNull()
})

test('establishes config from complete set of inputs', () => {
    process.env['INPUT_MODE'] = 'validate'
    process.env['INPUT_REPO-TOKEN'] = 'mockRepoToken'
    process.env['INPUT_MAJOR-LABEL'] = 'major-label-name'
    process.env['INPUT_MINOR-LABEL'] = 'minor-label-name'
    process.env['INPUT_PATCH-LABEL'] = 'patch-label-name'
    process.env['INPUT_REQUIRE-RELEASE-NOTES'] = 'true'
    process.env['INPUT_RELEASE-NOTES-PREFIX'] = 'release-notes-prefix-text'
    process.env['INPUT_RELEASE-NOTES-SUFFIX'] = 'release-notes-suffix-text'
    process.env['INPUT_WITH-V'] = 'true'
    process.env['INPUT_DRY-RUN'] = 'true'
    process.env['INPUT_VERSION'] = '1.4.2'

    const config = getConfig()
    expect(config.mode).toBe('validate')
    expect(config.releaseLabels).toEqual({
        'major-label-name': 'major',
        'minor-label-name': 'minor',
        'patch-label-name': 'patch',
    })
    expect(config.releaseNotesPrefixPattern).toEqual(new RegExp('release-notes-prefix-text'))
    expect(config.releaseNotesSuffixPattern).toEqual(new RegExp('release-notes-suffix-text'))
    expect(config.requireReleaseNotes).toBe(true)
    expect(config.v).toBe('v')
    expect(config.dryRun).toBe(true)
    expect(config.version).toBe('1.4.2')
    expect(config.octokit).toBeDefined()
    expect(config.octokit).not.toBeNull()
})

test('throws when a required input is missing', () => {
    process.env['INPUT_MODE'] = ''
    process.env['INPUT_REPO-TOKEN'] = 'mockRepoToken'
    expect(getConfig).toThrow('Input required and not supplied: mode')
})

test('errors out when an invalid mode is specified', () => {
    process.env['INPUT_MODE'] = 'invalid'
    process.env['INPUT_REPO-TOKEN'] = 'mockRepoToken'
    expect(getConfig).toThrow("mode must be either 'validate' or 'bump'")
})

test('throws when an invalid version is specified', () => {
    process.env['INPUT_MODE'] = 'validate'
    process.env['INPUT_REPO-TOKEN'] = 'mockRepoToken'
    process.env['INPUT_VERSION'] = 'invalid'
    expect(getConfig).toThrow("invalid input version: 'invalid'")
})
