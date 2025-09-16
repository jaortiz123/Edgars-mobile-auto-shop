#!/bin/bash
# GitHub Branch Protection Setup Script
# Run this from repository root with GITHUB_TOKEN environment variable set

set -e

REPO_OWNER="your-username"  # Replace with actual GitHub username/org
REPO_NAME="Edgars-mobile-auto-shop"  # Replace if different
BRANCH="main"  # Or "master" if using master branch

if [[ -z "$GITHUB_TOKEN" ]]; then
    echo "❌ Error: GITHUB_TOKEN environment variable not set"
    echo "   Create a personal access token with 'repo' scope at:"
    echo "   https://github.com/settings/tokens"
    echo "   Then export GITHUB_TOKEN=your_token_here"
    exit 1
fi

echo "🔒 Setting up branch protection for ${REPO_OWNER}/${REPO_NAME}:${BRANCH}"

# Apply branch protection using the JSON configuration
curl -X PUT \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  -d @.github/branch-protection-setup.json \
  "https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/branches/${BRANCH}/protection"

if [[ $? -eq 0 ]]; then
    echo "✅ Branch protection rules applied successfully"
    echo "   - Required status checks: backend-tests, frontend-tests, coverage-gate"
    echo "   - Require PR reviews: 1 approving review"
    echo "   - Dismiss stale reviews: enabled"
    echo "   - Enforce for admins: enabled"
    echo "   - Force pushes: disabled"
    echo "   - Branch deletions: disabled"
else
    echo "❌ Failed to apply branch protection rules"
    exit 1
fi
