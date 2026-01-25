#!/bin/bash
set -e

echo "=========================================="
echo "  MyAEGEE Monorepo Tag Migration"
echo "=========================================="
echo ""

# Module current versions from package.json
declare -A MODULES=(
  ["core"]="1.40.1"
  ["events"]="1.8.0"
  ["frontend"]="1.45.5"
  ["discounts"]="1.2.6"
  ["knowledge"]="1.0.6"
  ["network"]="1.3.2"
  ["statutory"]="1.14.8"
  ["summeruniversity"]="1.6.6"
  ["mailer"]="0.19.0"
  ["gsuite-wrapper"]="1.3.3"
)

OLD_TAGS_TO_DELETE=()
DRY_RUN=false

# Parse arguments
if [[ "$1" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "🔍 DRY RUN MODE - No tags will be created/deleted"
  echo ""
fi

for module in "${!MODULES[@]}"; do
  version="${MODULES[$module]}"
  old_tag="$version"
  new_tag="${module}@${version}"
  
  echo "Processing: $module (v$version)"
  
  # Check if new tag already exists
  if git rev-parse "$new_tag" >/dev/null 2>&1; then
    echo "  ✓ Tag $new_tag already exists, skipping"
    continue
  fi
  
  # Find the commit for this module's version
  # Strategy 1: Look for release commit
  commit=$(git log stable --all --format="%H" -1 \
    --grep="chore(release): ${version}" \
    -- "${module}/package.json" 2>/dev/null || echo "")
  
  # Strategy 2: Look for old-style tag
  if [ -z "$commit" ] && git rev-parse "$old_tag" >/dev/null 2>&1; then
    # Verify tag belongs to this module
    files=$(git show "$old_tag" --stat --oneline | grep "$module/" || echo "")
    if [ -n "$files" ]; then
      commit="$old_tag"
      echo "  → Found old tag $old_tag (belongs to $module)"
      OLD_TAGS_TO_DELETE+=("$old_tag")
    fi
  fi
  
  # Strategy 3: Use commit where package.json has this version
  if [ -z "$commit" ]; then
    commit=$(git log stable --all --format="%H" -1 \
      -S "\"version\": \"${version}\"" \
      -- "${module}/package.json" 2>/dev/null || echo "")
  fi
  
  # Strategy 4: Fallback - most recent commit touching module
  if [ -z "$commit" ]; then
    echo "  ⚠ Could not find specific commit for v$version"
    commit=$(git log stable -1 --format="%H" -- "${module}/" 2>/dev/null || echo "")
    if [ -n "$commit" ]; then
      echo "  → Using latest commit for $module as baseline"
    fi
  fi
  
  if [ -n "$commit" ]; then
    if [ "$DRY_RUN" = true ]; then
      echo "  [DRY RUN] Would create: $new_tag at $commit"
    else
      git tag "$new_tag" "$commit"
      echo "  ✅ Created $new_tag at ${commit:0:8}"
    fi
  else
    echo "  ❌ ERROR: Could not find commit for $module"
    exit 1
  fi
  
  echo ""
done

echo "=========================================="
echo "  Migration Summary"
echo "=========================================="
echo ""
echo "New tags created:"
git tag --list | grep '@' | sort
echo ""

if [ ${#OLD_TAGS_TO_DELETE[@]} -gt 0 ]; then
  echo "Old tags to remove:"
  printf '  %s\n' "${OLD_TAGS_TO_DELETE[@]}"
  echo ""
  
  if [ "$DRY_RUN" = false ]; then
    echo "To delete old tags locally:"
    echo "  git tag -d ${OLD_TAGS_TO_DELETE[@]}"
    echo ""
    echo "To push changes to remote:"
    echo "  git push origin --tags"
    echo "  git push origin --delete ${OLD_TAGS_TO_DELETE[@]}"
  fi
fi

echo ""
if [ "$DRY_RUN" = true ]; then
  echo "🔍 Dry run complete. Run without --dry-run to apply changes."
else
  echo "✅ Tag migration complete!"
  echo ""
  echo "⚠️  IMPORTANT: Review tags carefully before pushing!"
  echo "   git tag --list | grep '@'"
  echo ""
  echo "Then push:"
  echo "   git push origin --tags"
fi
