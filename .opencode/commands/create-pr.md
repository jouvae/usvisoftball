---
description: Create or update a pull request. Runs pre-flight checks, analyzes the diff, bumps versions, updates changelogs, and generates the PR body. Supports draft PRs for WIP branches.
---

# Create Pull Request Command

You are creating a pull request. Follow the steps below precisely.

## STEP 1: Pre-flight Checks

```bash
gh auth status 2>&1 || echo "NOT_AUTHENTICATED"
git branch --show-current
git remote show origin | grep 'HEAD branch' | sed 's/.*: //'
git status --short
gh pr list --head BRANCH_NAME --state open --json number,title --jq '.[0] // empty'
```

## STEP 2: Fetch and Analyze Changes

```bash
git fetch origin main 2>&1
git log origin/main..HEAD --oneline
git diff origin/main...HEAD --stat
```

## STEP 3: Version Bumps and Changelogs

Determine which apps changed and bump versions:

| Path pattern | App | VERSION file | CHANGELOG |
|---|---|---|---|
| `services/alpha/**`, `libs/**`, `apis/**` | alpha | `services/alpha/VERSION` | `services/alpha/CHANGELOG.md` |
| `clients/web/**` | web | `clients/web/VERSION` | `clients/web/CHANGELOG.md` |
| `services/tron/**`, `clients/tron/**` | tron | `services/tron/VERSION` | `services/tron/CHANGELOG.md` |

## STEP 4: Generate PR Content

Title format: `feat:` / `fix:` / `refactor:` / `docs:` prefix.

Body sections: Description, Changes, Versions, Changelog, Testing Instructions.

## STEP 5: Review and Create

Show the user the PR content and ask for approval before creating.

## STEP 6: Create or Update

```bash
gh pr create --title "TITLE" --body "BODY" --base main
```

## Hard Rules

- Do NOT add any AI attribution in the PR title, body, or commits.
- Always ask for user approval before creating the PR.
