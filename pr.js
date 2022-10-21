const github = require('@actions/github')

// Returns the PR number from a commit message, or null if one can't be found.
function extractPRNumber(commitMsg) {
    const re = /Merge pull request #(\d+) from/
    const matches = commitMsg.match(re)
    if (matches !== null && matches.length > 1) {
        return matches[1].trim()
    }

    // Squash Merges do not have the merge pull request commit message
    // but use the PR Title (#<pr num>) syntax by default
    const squashRE = /\(#(\d+)\)/
    const squashMatches = commitMsg.match(squashRE)
    if (squashMatches !== null && squashMatches.length > 1) {
        return squashMatches[1].trim()
    }

    return null
}

async function searchPRByCommit(commitSHA, config) {
    // Query GitHub to see if the commit sha is related to a PR
    // Rebase merge will not have the information in the commit message
    try {
        const q = `type:pull-request is:merged ${commitSHA}`
        const data = await config.octokit.rest.search.issuesAndPullRequests({ q })

        if (data.data.total_count < 1) {
            throw new Error('No results found querying for the PR')
        }

        // We should only find one PR with the commit SHA that was merged so take the first one
        const pr = data.data.items[0]
        return pr
    } catch (fetchError) {
        throw new Error(`Failed to find PR by commit SHA ${commitSHA}: ${fetchError.message}`)
    }
}

// Fetches the details of a pull request.
async function fetchPR(num, config) {
    try {
        const data = await config.octokit.rest.pulls.get({
            ...github.context.repo,
            pull_number: num,
        })

        return data.data
    } catch (fetchError) {
        throw new Error(`failed to fetch data for PR #${num}: ${fetchError.message}`)
    }
}

// Retuns the release type (major, minor, or patch) based on the tags in the PR.
function getReleaseType(pr, config) {
    const labelNames = pr.labels.map((label) => label.name)
    const releaseLabelsPresent = labelNames.filter(
        (name) => Object.keys(config.releaseLabels).includes(name),
    )
    if (releaseLabelsPresent.length === 0) {
        throw new Error('no release label specified on PR')
    } else if (releaseLabelsPresent.length > 1) {
        throw new Error(`too many release labels specified on PR: ${releaseLabelsPresent}`)
    }

    return config.releaseLabels[releaseLabelsPresent[0]]
}

// Extracts the release notes from the PR body.
function getReleaseNotes(pr, config) {
    let notes = []

    if (pr.body !== null && pr.body !== '') {
        const lines = pr.body.split(/\r?\n/)
        let withinNotes = config.releaseNotesPrefixPattern === undefined
        let firstLine = 0

        // Default to the entire PR body
        let lastLine = lines.length

        // If a prefix or suffix has been defined default to none of the PR body
        if (config.releaseNotesPrefixPattern !== undefined
                || config.releaseNotesSuffixPattern !== undefined) {
            lastLine = 0
        }

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i]

            if (withinNotes) {
                if (config.releaseNotesSuffixPattern !== undefined
                    && config.releaseNotesSuffixPattern.test(line)) {
                    lastLine = i
                    break
                }
            } else if (config.releaseNotesPrefixPattern !== undefined
                && config.releaseNotesPrefixPattern.test(line)) {
                // Now that we've seen the prefix, set the lastLine to the end of the message
                lastLine = lines.length
                firstLine = i + 1
                withinNotes = true
            }
        }

        notes = lines.slice(firstLine, lastLine)
    }

    if (notes.length === 0 && config.requireReleaseNotes) {
        throw new Error('missing release notes')
    }

    return notes.join('\n').trim()
}

exports.extractPRNumber = extractPRNumber
exports.searchPRByCommit = searchPRByCommit
exports.fetchPR = fetchPR
exports.getReleaseType = getReleaseType
exports.getReleaseNotes = getReleaseNotes
