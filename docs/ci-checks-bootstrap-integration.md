# Bootstrap Integration - CI Dependencies

## Summary

Integrated CI dependency installation into the main bootstrap script (`scripts-ubuntu/bootstrap.sh`). Now developers get prompted to install CI linting tools during initial setup!

## What Changed

### Modified File: `scripts-ubuntu/bootstrap.sh`

Added a new optional step: `install_ci_dependencies()`

**What it does:**

1. Explains what CI tools are and why they're useful
2. Prompts user if they want to install CI checking tools
3. Runs `install-ci-dependencies.sh` if user agrees
4. Offers to set up pre-push git hooks as well
5. Gracefully skips if declined (with instructions for later)

**When it runs:**

- After environment setup
- Before validation
- As an **optional** step (won't fail if skipped or if installation fails)

## User Experience Flow

### During Bootstrap

```
...
[Step 6/7: Setting Up Environment Variables]
✓ Environment configured

[Installing CI/lint checking tools (optional)]

These tools allow you to run the same checks locally that CircleCI runs:
  • shellcheck - Shell script linter
  • hadolint - Dockerfile linter
  • yamllint - YAML linter
  • pylint - Python linter

This helps catch issues before pushing to prevent CI failures.

Install CI checking tools? (Recommended for contributors) [Y/n]: y

Running CI dependencies installer...

═══════════════════════════════════════════════════════
  Installing CI Dependencies
═══════════════════════════════════════════════════════

Checking shellcheck...
✓ shellcheck installed successfully

Checking hadolint...
✓ hadolint installed successfully

Checking Python linting tools...
✓ Python packages installed successfully

═══════════════════════════════════════════════════════
✓ All dependencies installed successfully!
═══════════════════════════════════════════════════════

✓ CI dependencies installed

Would you also like to set up pre-push git hooks?
This will automatically run checks before you push code.

Setup pre-push hooks? [Y/n]: y

[Git hooks setup runs...]
✓ Git hooks configured

[Step 7/7: Validating Installation]
...
```

### If User Declines

```
Install CI checking tools? (Recommended for contributors) [Y/n]: n

Skipping CI tools installation
You can install them later with: make install-ci-deps
```

## Benefits

### For New Contributors

**Before:**

```bash
./scripts-ubuntu/bootstrap.sh
# ... setup completes
make start
# ... develop some code
git push
# ❌ CI fails due to linting errors!
# Now they need to figure out how to install linting tools
```

**After:**

```bash
./scripts-ubuntu/bootstrap.sh
# During setup, gets prompted:
#   "Install CI checking tools? [Y/n]: y"
# Tools get installed automatically!
# Hooks get set up automatically!
make start
# ... develop some code
git push
# ✓ Pre-push hooks run locally first
# ✓ Catches issues before pushing
# ✓ CI passes on first try!
```

### For Existing Contributors

Nothing changes! They can:

- Skip the prompt if they already have tools
- Skip if they don't want tools
- Install later with `make install-ci-deps`

## Design Decisions

### Why Optional?

1. **Not required to run MyAEGEE** - These are development tools, not runtime dependencies
2. **User choice** - Some may prefer different workflows
3. **Graceful degradation** - Skipping doesn't break bootstrap
4. **Clear guidance** - Shows how to install later if skipped

### Why in Bootstrap?

1. **Best time** - User is already in setup mode
2. **Context-aware** - User understands they're setting up dev environment
3. **One-time setup** - Get everything configured at once
4. **Reduces friction** - No separate step to remember

### Why Prompt for Git Hooks Too?

1. **Logical flow** - If installing tools, probably want to use them
2. **Complete setup** - Tools + hooks = full CI workflow
3. **Still optional** - User can decline hooks separately
4. **Clear explanation** - Shows what hooks do

## Bootstrap Script Changes

### New Function

```bash
install_ci_dependencies() {
    # Explains what CI tools are
    # Prompts user to install
    # Runs install-ci-dependencies.sh
    # Offers to setup git hooks
    # Provides instructions if skipped
}
```

### Updated Main Flow

```bash
main() {
    # ... existing steps
    setup_environment || exit 1
    increase_inotify_limits

    # NEW: Optional CI tools
    install_ci_dependencies

    validate_installation
    print_next_steps
}
```

### Updated Next Steps

Added helpful reminders about CI tools in the completion message:

```
Development workflow tips:
  - Run CI checks before pushing: make ci-check
  - Fast CI checks (no tests): make ci-check-fast
  - Setup git pre-push hooks: make setup-hooks
  - See full CI docs: docs/local-ci-checks.md
```

## Documentation Updates

### README.md

- Updated bootstrap command note
- Mentions CI tools setup during bootstrap

### docs/local-ci-checks.md

- Added "Option A: During Bootstrap" as first choice
- Reorganized options (Bootstrap > Auto > Manual)
- Clear guidance on each approach

## Testing Scenarios

### Scenario 1: Fresh Install, Accept All

```bash
./scripts-ubuntu/bootstrap.sh
# Install CI tools? Y
# Setup git hooks? Y
# Result: Full setup with tools and hooks
```

### Scenario 2: Fresh Install, Decline Tools

```bash
./scripts-ubuntu/bootstrap.sh
# Install CI tools? n
# Result: Bootstrap completes, shows how to install later
```

### Scenario 3: Fresh Install, Tools Yes, Hooks No

```bash
./scripts-ubuntu/bootstrap.sh
# Install CI tools? Y
# Setup git hooks? n
# Result: Tools installed, can setup hooks later
```

### Scenario 4: Re-run Bootstrap

```bash
./scripts-ubuntu/bootstrap.sh
# Already has tools: Skips most steps
# Still offers to install CI tools (idempotent)
# Result: Can update or skip
```

## Impact

### Positive

- ✅ Better onboarding for new contributors
- ✅ Encourages best practices (local CI checks)
- ✅ Reduces CI failures from preventable issues
- ✅ One-time setup instead of multiple steps
- ✅ Clear guidance for all paths

### Minimal

- Adds ~30 seconds to bootstrap if tools accepted
- Adds one prompt (easily skipped with 'n')
- No impact if declined

### None

- No impact on existing installations
- No impact on users who decline
- No changes to runtime behavior

## Commands Summary

```bash
# Fresh install - includes CI tools option
./scripts-ubuntu/bootstrap.sh

# Install CI tools later (if skipped)
make install-ci-deps

# Setup git hooks later (if skipped)
make setup-hooks

# Run CI checks manually
make ci-check
```

## Future Enhancements

Potential improvements for later:

1. **Remember choice** - Store in `.env` or config
2. **Update command** - `make update-ci-deps` to refresh tools
3. **Auto-update** - Check for new tool versions
4. **Profile support** - Different tool sets for different roles

## Conclusion

The integration provides a smooth, optional way to set up CI tools during initial bootstrap. It:

- Reduces friction for new contributors
- Encourages local CI checking
- Maintains flexibility (fully optional)
- Provides clear guidance for all paths

Perfect for a modern development workflow! 🎉
