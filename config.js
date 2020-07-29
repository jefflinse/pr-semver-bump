const core = require('@actions/core');

// Gets all the required inputs and validates them before proceeding.
function getConfig() {
    const mode = core.getInput('mode', { required: true }).toLowerCase();
    if (mode !== 'validate' && mode !== 'bump') {
        core.setFailed("mode must be either 'validate' or 'bump'");
    }

    const releaseNotesPrefix = core.getInput('release-notes-prefix');
    const releaseNotesSuffix = core.getInput('release-notes-suffix');

    var releaseLabels = {};
    releaseLabels[core.getInput('major-label') || 'major-release'] = 'major';
    releaseLabels[core.getInput('minor-label') || 'minor-release'] = 'minor';
    releaseLabels[core.getInput('patch-label') || 'patch-release'] = 'patch';

    return {
        mode: mode,
        releaseLabels: releaseLabels,
        releaseNotesRegex: new RegExp(`${releaseNotesPrefix}([\\s\\S]*)${releaseNotesSuffix}`),
        requireReleaseNotes: core.getInput('require-release-notes').toLowerCase() === 'true',
        v: core.getInput('with-v').toLowerCase() === 'true' ? 'v' : '',
    };
}

exports.getConfig = getConfig;
