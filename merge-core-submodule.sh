#!/bin/bash

# Script to merge the 'core' git submodule into the parent repository
# while preserving all commit history with correct paths.
#
# This script:
# 1. Clones the core repository to a temporary location
# 2. Rewrites its history to prefix all paths with 'core/'
# 3. Merges it into the parent repository
# 4. Removes the submodule configuration
#
# IMPORTANT: Make sure you have a backup and commit all changes before running!

set -e  # Exit on error

SUBMODULE_NAME="knowledge"
SUBMODULE_URL="https://github.com/AEGEE/knowledge"
TEMP_DIR="/tmp/core-merge-$$"

echo "========================================="
echo "Merging submodule: $SUBMODULE_NAME"
echo "========================================="
echo ""

# Step 1: Check prerequisites
echo "[1/8] Checking prerequisites..."

if ! git diff-index --quiet HEAD --; then
    echo "ERROR: You have uncommitted changes. Please commit or stash them first."
    exit 1
fi

if [ ! -d "$SUBMODULE_NAME" ]; then
    echo "ERROR: Submodule directory '$SUBMODULE_NAME' not found."
    exit 1
fi

# Clean up any leftover remote from previous runs
git remote remove "temp-$SUBMODULE_NAME" 2>/dev/null || true

# Check if git-filter-repo is available (recommended over filter-branch)
if command -v git-filter-repo &> /dev/null; then
    USE_FILTER_REPO=true
    echo "Using git-filter-repo (recommended)"
else
    USE_FILTER_REPO=false
    echo "Using git filter-branch (git-filter-repo not found)"
    echo "Consider installing git-filter-repo for better performance:"
    echo "  pip3 install git-filter-repo"
fi

# Step 2: Clone the submodule to a temporary directory
echo ""
echo "[2/8] Cloning submodule to temporary directory..."
git clone "$SUBMODULE_URL" "$TEMP_DIR"

# Step 3: Rewrite history to prefix all paths with submodule name
echo ""
echo "[3/8] Rewriting submodule history to prefix paths with '$SUBMODULE_NAME/'..."
cd "$TEMP_DIR"

if [ "$USE_FILTER_REPO" = true ]; then
    # Using git-filter-repo (faster and safer)
    git filter-repo --to-subdirectory-filter "$SUBMODULE_NAME" --force
else
    # Using git filter-branch (legacy method)
    export FILTER_BRANCH_SQUELCH_WARNING=1
    git filter-branch --tree-filter "
        mkdir -p $SUBMODULE_NAME
        git ls-tree --name-only \$GIT_COMMIT | while read filename; do
            if [ \"\$filename\" != \"$SUBMODULE_NAME\" ]; then
                mv \"\$filename\" \"$SUBMODULE_NAME/\" 2>/dev/null || true
            fi
        done
    " --tag-name-filter cat -- --all
fi

cd -

# Step 4: Temporarily remove the submodule directory
echo ""
echo "[4/8] Temporarily removing submodule directory..."
# Deinitialize and remove the submodule directory
git submodule deinit -f "$SUBMODULE_NAME"
git rm -f "$SUBMODULE_NAME"
rm -rf ".git/modules/$SUBMODULE_NAME"

# Commit the removal
git commit -m "Temporarily remove '$SUBMODULE_NAME' submodule for merge"

# Step 5: Add the rewritten repository as a remote
echo ""
echo "[5/8] Adding temporary repository as remote..."
git remote add "temp-$SUBMODULE_NAME" "$TEMP_DIR"
git fetch "temp-$SUBMODULE_NAME" --tags

# Step 6: Merge the submodule history
echo ""
echo "[6/8] Merging submodule history into parent repository..."
# Get the default branch of the temp repo
TEMP_BRANCH=$(cd "$TEMP_DIR" && git symbolic-ref --short HEAD)
echo "Merging branch: $TEMP_BRANCH"

# Allow unrelated histories since the submodule was a separate repo
git merge "temp-$SUBMODULE_NAME/$TEMP_BRANCH" --allow-unrelated-histories -m "Merge '$SUBMODULE_NAME' submodule into parent repository

This merge integrates the entire commit history of the $SUBMODULE_NAME
submodule (from $SUBMODULE_URL) into the parent repository.

All file paths have been rewritten to be under $SUBMODULE_NAME/.
The submodule configuration will be updated in a subsequent commit."

# Step 7: Finalize submodule removal from .gitmodules
echo ""
echo "[7/8] Finalizing submodule configuration removal..."

# Remove submodule from .gitmodules
git config -f .gitmodules --remove-section "submodule.$SUBMODULE_NAME" 2>/dev/null || true

# If .gitmodules is empty, remove it
if [ -f .gitmodules ] && [ ! -s .gitmodules ]; then
    git rm .gitmodules 2>/dev/null || true
else
    git add .gitmodules 2>/dev/null || true
fi

# Commit the .gitmodules change
if ! git diff --cached --quiet 2>/dev/null; then
    git commit -m "Remove '$SUBMODULE_NAME' from .gitmodules

The code is now part of the parent repository at $SUBMODULE_NAME/.
All commit history has been preserved."
fi

# Step 8: Cleanup
echo ""
echo "[8/8] Cleaning up..."
git remote remove "temp-$SUBMODULE_NAME"
rm -rf "$TEMP_DIR"

echo ""
echo "========================================="
echo "SUCCESS! Submodule merge complete."
echo "========================================="
echo ""
echo "The '$SUBMODULE_NAME' submodule has been successfully merged."
echo "All commits have been preserved with paths prefixed as '$SUBMODULE_NAME/'."
echo ""
echo "Summary of commits created:"
git log --oneline -3
echo ""
echo "Next steps:"
echo "1. Review the changes: git log --oneline --graph"
echo "2. Check that files are in the right place: ls -la $SUBMODULE_NAME/"
echo "3. Test that everything works correctly"
echo "4. Push to remote: git push origin <your-branch-name>"
echo ""
echo "If something went wrong, you can reset with:"
echo "  git reset --hard HEAD~3"
echo "  git submodule update --init $SUBMODULE_NAME"
echo ""
