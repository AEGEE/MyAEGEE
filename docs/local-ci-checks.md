# Local CI Checks and Pre-Push Hooks

This document explains how to run CircleCI checks locally before pushing code, ensuring your changes will pass CI tests remotely.

## Overview

The MyAEGEE project uses CircleCI for continuous integration. To catch issues early and avoid failed CI builds, you can run the same checks locally before pushing.

## Features

- **Automatic Detection**: Detects which modules have changed and runs checks only on those
- **Comprehensive Checks**: Runs all the same linters and tests that CircleCI runs
- **Pre-Push Hook**: Automatically runs checks before you push (optional)
- **Fast Mode**: Skip slow checks like tests when you're in a hurry
- **Detailed Output**: Clear pass/fail status for each check

## Quick Start

### 1. Install Dependencies

**Option A: During Bootstrap (Easiest)**

If you haven't run bootstrap yet, or want to run it again:

```bash
./scripts-ubuntu/bootstrap.sh
# When prompted, choose "Yes" to install CI checking tools
```

The bootstrap script will optionally install all CI dependencies and set up git hooks for you!

**Option B: Automatic Installation**

If you already ran bootstrap, use the provided installation script:

```bash
# Install all dependencies automatically
make install-ci-deps
# or
./scripts-ubuntu/install-ci-dependencies.sh
```

The script will install:

- shellcheck (shell script linter)
- hadolint (Dockerfile linter)
- yamllint (YAML linter)
- pylint (Python linter)

**Option C: Manual Installation**

If you prefer to install manually:

````bash
## Dependencies

**Quick Install:**
```bash
make install-ci-deps
````

**Or install manually:**

```bash
# System packages
sudo apt-get install -y shellcheck

# Hadolint
wget -qO /tmp/hadolint https://github.com/hadolint/hadolint/releases/download/v2.12.0/hadolint-Linux-x86_64
sudo mv /tmp/hadolint /usr/local/bin/hadolint
sudo chmod +x /usr/local/bin/hadolint

# Python tools
pip3 install --user yamllint pylint

# Add to PATH if needed
export PATH="$HOME/.local/bin:$PATH"
```

````

### 2. Setup Git Hooks (Recommended)

Install the pre-push hook that automatically runs checks:

```bash
make setup-hooks
# or
./scripts-ubuntu/setup-git-hooks.sh
````

This will:

- Install a pre-push hook in `.git/hooks/`
- Check for missing dependencies and offer to install them
- Optionally run an initial check

### 3. Push with Confidence

Now when you push, checks will run automatically:

```bash
git push
```

If checks fail, the push will be blocked. Fix the issues and try again, or bypass with `git push --no-verify` if you know what you're doing.

## Manual Usage

You can run checks manually at any time without pushing:

### Check Changed Modules Only

```bash
./scripts-ubuntu/run-ci-checks.sh
```

This detects uncommitted changes and unpushed commits, then runs checks only on affected modules.

### Check All Modules

```bash
./scripts-ubuntu/run-ci-checks.sh --all
```

### Check Specific Modules

```bash
./scripts-ubuntu/run-ci-checks.sh core events frontend
```

### Fast Mode (Skip Tests)

```bash
./scripts-ubuntu/run-ci-checks.sh --fast
```

This skips time-consuming tests and docker builds, running only linters.

### Combine Options

```bash
./scripts-ubuntu/run-ci-checks.sh --fast core events
```

## What Gets Checked

The script runs different checks depending on the module:

### All Modules

- **yamllint**: YAML syntax and style
- **hadolint**: Dockerfile linting
- **shellcheck**: Shell script linting

### Node.js Modules (core, events, frontend, etc.)

- **eslint**: JavaScript/Vue linting
- **npm audit**: Security vulnerability check
- **npm test**: Full test suite (skipped in fast mode)

### Root Level

- **pylint**: Python script linting (for scripts-server)
- **shellcheck**: Shell scripts in scripts-ubuntu, scripts-server, etc.

## Understanding Output

### Status Symbols

- ✓ **PASS** - Check succeeded (green)
- ✗ **FAIL** - Check failed (red)
- ⊘ **SKIP** - Check skipped (yellow, not applicable or tool missing)

### Example Output

```
═══════════════════════════════════════════════════════
  MyAEGEE Local CI Checks
═══════════════════════════════════════════════════════

Checking changed modules: core events

═══════════════════════════════════════════════════════
  Checking module: core
═══════════════════════════════════════════════════════
✓ yamllint [core]
✓ hadolint [core]
✓ shellcheck [core]
✓ eslint [core]
✓ npm audit [core]
⊘ tests [core] (skipped)

═══════════════════════════════════════════════════════
  Check Summary
═══════════════════════════════════════════════════════
Passed: 10 checks
Skipped: 2 checks

✓ All checks passed! You're ready to push.
```

## Bypassing Checks

Sometimes you need to push without passing checks:

```bash
# Bypass pre-push hook
git push --no-verify

# Or skip checks entirely
git config core.hooksPath /dev/null  # Disable hooks permanently (not recommended)
```

**Note**: Only bypass checks if you have a good reason. Failed CI builds slow down everyone.

## Troubleshooting

### "Command not found" errors

Install missing dependencies as shown in the setup section above.

### Checks taking too long

Use fast mode to skip tests:

```bash
./scripts-ubuntu/run-ci-checks.sh --fast
```

### False positives

If a linter reports an issue that doesn't make sense:

1. Check if CircleCI configuration excludes that check
2. Update the exclusions in `run-ci-checks.sh` to match

### Hook not running

Check that the hook is installed:

```bash
ls -l .git/hooks/pre-push
```

If missing, run the setup script again.

### Hook always skipping checks

Make sure `run-ci-checks.sh` exists and is executable:

```bash
ls -l scripts-ubuntu/run-ci-checks.sh
chmod +x scripts-ubuntu/run-ci-checks.sh
```

## Customization

### Changing Hook Behavior

Edit `.git/hooks/pre-push` to customize:

- Remove `--fast` flag to run full tests before push
- Add specific modules to always check
- Change exit behavior

### Adding New Checks

Edit `scripts-ubuntu/run-ci-checks.sh` to add new checks:

1. Add a new `run_*` function
2. Call it in `run_module_checks()`
3. Update documentation

### Module-Specific Configuration

Each module can have its own linter configuration:

- `.yamllint.yml` - YAML linting rules
- `.eslintrc.js` - ESLint rules
- `package.json` - Lint and test scripts

## Integration with Development Workflow

### Recommended Workflow

1. **Make changes** to one or more modules
2. **Run checks** manually during development:
   ```bash
   ./scripts-ubuntu/run-ci-checks.sh --fast core
   ```
3. **Commit** your changes:
   ```bash
   git commit -m "feat: add new feature"
   ```
4. **Push** - pre-push hook runs automatically:
   ```bash
   git push
   ```

### CI/CD Pipeline

```
Local Development
    ↓
[Local CI Checks] ← You are here
    ↓
git push
    ↓
[CircleCI Remote Checks]
    ↓
Review & Merge
```

By running checks locally, you catch issues early and reduce CI failures.

## Performance Tips

1. **Use fast mode during development**: `--fast` skips slow tests
2. **Check specific modules**: Don't check everything every time
3. **Install dependencies locally**: Avoid repeated installations
4. **Use git efficiently**: Small, focused commits make checks faster

## Module Detection

The script automatically detects changes by examining:

- Uncommitted changes (`git status`)
- Unpushed commits (`git diff @{upstream}..`)

Changed modules are identified by file paths:

- `core/lib/file.js` → checks `core` module
- `events/test/test.js` → checks `events` module
- `scripts-ubuntu/setup.sh` → checks `root` level

## Advanced Usage

### Running in CI/CD

You can use the same script in other CI systems:

```bash
# In GitLab CI, GitHub Actions, etc.
./scripts-ubuntu/run-ci-checks.sh --all
```

### Parallel Execution

For faster checking, run modules in parallel:

```bash
# In separate terminals
./scripts-ubuntu/run-ci-checks.sh core &
./scripts-ubuntu/run-ci-checks.sh events &
./scripts-ubuntu/run-ci-checks.sh frontend &
wait
```

### Integration with IDEs

Many IDEs can run these checks automatically:

- **VS Code**: Use tasks.json to define check tasks
- **WebStorm/IntelliJ**: Configure external tools
- **vim/neovim**: Use ALE or other linting plugins

## Getting Help

Run with `--help` for usage information:

```bash
./scripts-ubuntu/run-ci-checks.sh --help
```

## See Also

- [CircleCI Configuration](../.circleci/config.yml) - Remote CI setup
- [Contributing Guidelines](../CONTRIBUTING.md) - Code contribution workflow
- [Setup Guide](./setup-ubuntu-direct.md) - Development environment setup
