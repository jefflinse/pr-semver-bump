const core = require('@actions/core');
const github = require('@actions/github');

// Gets all the required inputs and validates them before proceeding.
function getConfig() {
    const mode = core.getInput('mode', { required: true }).toLowerCase();
    if (mode !== 'validate' && mode !== 'bump') {
        throw new Error("mode must be either 'validate' or 'bump'");
    }

    const token = core.getInput('repo-token', { required: true });
    core.setSecret(token);

    const releaseNotesPrefix = core.getInput('release-notes-prefix');
    const releaseNotesSuffix = core.getInput('release-notes-suffix');

    var releaseLabels = {};
    releaseLabels[core.getInput('major-label') || 'major release'] = 'major';
    releaseLabels[core.getInput('minor-label') || 'minor release'] = 'minor';
    releaseLabels[core.getInput('patch-label') || 'patch release'] = 'patch';

    return {
        mode: mode,
        octokit: github.getOctokit(token),
        releaseLabels: releaseLabels,
        releaseNotesRegex: new RegExp(`${releaseNotesPrefix}([^]*)${releaseNotesSuffix}`),
        requireReleaseNotes: core.getInput('require-release-notes').toLowerCase() === 'true',
        v: core.getInput('with-v').toLowerCase() === 'true' ? 'v' : '',
    };
}

exports.getConfig = getConfig;
