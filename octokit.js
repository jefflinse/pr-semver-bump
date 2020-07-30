const core = require('@actions/core');
const github = require('@actions/github');

// Return an instance of octokit using the user-supplied access token.
function octokit() {
    const token = core.getInput('repo-token', { required: true });
    core.setSecret(token);
    return github.getOctokit(token);
}

exports.octokit = octokit
