const github = require('@actions/github');

// Returns the PR number from a commit message, or null if one can't be found.
function extractPRNumber(commitMsg) {
    const re = /Merge pull request #(\d+) from/
    const matches = commitMsg.match(re)
    if (matches !== null && matches.length > 1) {
        return matches[1].trim()
    }

    // Squash Merges do not have the merge pull request commit message
    // but use the PR Title (#<pr num>) syntax by default
    const squash_re = /\(#(\d+)\)/
    const squash_matches = commitMsg.match(squash_re)
    if (squash_matches !== null && squash_matches.length > 1) {
        return squash_matches[1].trim()
    }

    return null
}

// Fetches the details of a pull request.
async function fetchPR(num, config) {
    try {
        const data = await config.octokit.pulls.get({
            ...github.context.repo,
            pull_number: num
        });

        return data.data;
    }
    catch (fetchError) {
        throw new Error(`failed to fetch data for PR #${num}: ${fetchError.message}`);
    }
}

// Retuns the release type (major, minor, or patch) based on the tags in the PR.
function getReleaseType(pr, config) {
    const labelNames = pr.labels.map(label => label.name)
    const releaseLabelsPresent = labelNames.filter(name => Object.keys(config.releaseLabels).includes(name))
    if (releaseLabelsPresent.length === 0) {
        throw new Error('no release label specified on PR')
    } else if (releaseLabelsPresent.length > 1) {
        throw new Error(`too many release labels specified on PR: ${releaseLabelsPresent}`)
    }

    return config.releaseLabels[releaseLabelsPresent[0]]
}

// Extracts the release notes from the PR body.
function getReleaseNotes(pr, config) {
    let notes = [];

    if (pr.body !== null && pr.body !== '') {
        let lines = pr.body.split(/\r?\n/);
        let withinNotes = config.releaseNotesPrefixPattern === undefined;
        let firstLine = 0;
        let lastLine = lines.length;

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];

            if (withinNotes) {
                if (config.releaseNotesSuffixPattern !== undefined && config.releaseNotesSuffixPattern.test(line)) {
                    lastLine = i;
                    break;
                }
            } else if (config.releaseNotesPrefixPattern !== undefined && config.releaseNotesPrefixPattern.test(line)) {
                firstLine = i + 1;
                withinNotes = true;
            }
        }

        notes = lines.slice(firstLine, lastLine);
    }

    if (notes.length === 0  && config.requireReleaseNotes) {
        throw new Error('missing release notes')
    }

    return notes.join("\n").trim();
}

exports.extractPRNumber = extractPRNumber
exports.fetchPR = fetchPR
exports.getReleaseType = getReleaseType
exports.getReleaseNotes = getReleaseNotes
