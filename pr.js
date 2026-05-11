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

// Returns a merged PR associated with the given commit SHA, or null if none
// is found. Tries the lighter-weight repos endpoint first; falls back to the
// search API (which is more rate-limited but works in some edge cases).
async function searchPRByCommit(commitSHA, config) {
    try {
        const assoc = await config.octokit.rest.repos.listPullRequestsAssociatedWithCommit({
            ...github.context.repo,
            commit_sha: commitSHA,
        })

        const merged = (assoc.data || []).find(
            (p) => p.merged_at !== null && p.merged_at !== undefined,
        )
        if (merged) {
            return merged
        }
    } catch (e) {
        // fall through to the search API
    }

    try {
        const q = `is:merged ${commitSHA}`
        const data = await config.octokit.rest.search.issuesAndPullRequests({ q })

        if (data.data.total_count < 1) {
            return null
        }

        return data.data.items[0]
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

// Returns the release type (major, minor, patch or skip) based on the tags in the PR.
function getReleaseType(pr, config) {
    const labelNames = pr.labels.map((label) => label.name)
    const releaseLabelsPresent = labelNames.filter(
        (name) => Object.keys(config.releaseLabels).includes(name),
    )
    const noopLabelsPresent = labelNames.filter(
        (name) => Object.keys(config.noopLabels).includes(name),
    )

    if (releaseLabelsPresent.length === 0 && noopLabelsPresent.length === 0) {
        const expected = [...Object.keys(config.releaseLabels), ...Object.keys(config.noopLabels)]
        throw new Error(`no release label specified on PR (expected one of: ${expected.join(', ')})`)
    } else if (releaseLabelsPresent.length > 1) {
        throw new Error(`too many release labels specified on PR: ${releaseLabelsPresent}`)
    } else if (releaseLabelsPresent.length >= 1 && noopLabelsPresent.length >= 1) {
        throw new Error(`too many labels specified, both release labels and noop labels specified: (${releaseLabelsPresent}) (${noopLabelsPresent}) on PR`)
    }

    return (releaseLabelsPresent.length === 1)
        ? config.releaseLabels[releaseLabelsPresent[0]]
        : config.noopLabels[noopLabelsPresent[0]]
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
