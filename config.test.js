const process = require('process');
const { getConfig } = require('./config');

// test('test runs', () => {
//     const ip = path.join(__dirname, 'index.js');
//     console.log(cp.execSync(`node ${ip}`, {env: process.env}).toString());
// })

test('establishes config from minimum required inputs', () => {
    process.env['INPUT_MODE'] = 'validate'
    const config = getConfig()
    expect(config).toEqual({
        mode: 'validate',
        releaseLabels: {
            'major-release': 'major',
            'minor-release': 'minor',
            'patch-release': 'patch',
        },
        releaseNotesRegex: new RegExp(`([\\s\\S]*)`),
        requireReleaseNotes: false,
        v: '',
    })
})

test('establishes config from complete set of inputs', () => {
    process.env['INPUT_MODE'] = 'validate'
    process.env['INPUT_MAJOR-LABEL'] = 'major-label-name'
    process.env['INPUT_MINOR-LABEL'] = 'minor-label-name'
    process.env['INPUT_PATCH-LABEL'] = 'patch-label-name'
    process.env['INPUT_REQUIRE-RELEASE-NOTES'] = 'true'
    process.env['INPUT_RELEASE-NOTES-PREFIX'] = 'release-notes-prefix-text'
    process.env['INPUT_RELEASE-NOTES-SUFFIX'] = 'release-notes-suffix-text'
    process.env['INPUT_WITH-V'] = 'true'
    const config = getConfig()
    expect(config).toEqual({
        mode: 'validate',
        releaseLabels: {
            'major-label-name': 'major',
            'minor-label-name': 'minor',
            'patch-label-name': 'patch',
        },
        releaseNotesRegex: new RegExp(`release-notes-prefix-text([\\s\\S]*)release-notes-suffix-text`),
        requireReleaseNotes: true,
        v: 'v',
    })
})
