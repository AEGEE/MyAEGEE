# Local CI Checks - Quick Reference

## Installation (One-Time Setup)

```bash
# Step 1: Install dependencies (automatic)
make install-ci-deps

# Step 2: Install the pre-push hook
make setup-hooks
# or
./scripts-ubuntu/setup-git-hooks.sh
```

**Note**: The setup script will also offer to install dependencies if they're missing.

## Usage

### Automatic (Recommended)

Checks run automatically before every push:

```bash
git push
```

### Manual Commands

```bash
# Check changed modules only (smart, fast)
make ci-check
./scripts-ubuntu/run-ci-checks.sh

# Fast mode - skip tests
make ci-check-fast
./scripts-ubuntu/run-ci-checks.sh --fast

# Check all modules
make ci-check-all
./scripts-ubuntu/run-ci-checks.sh --all

# Check specific modules
./scripts-ubuntu/run-ci-checks.sh core events frontend
```

## Bypass Checks (Use Sparingly)

```bash
# Skip pre-push hook temporarily
git push --no-verify
```

## What Gets Checked

- ✓ **yamllint** - YAML files syntax and style
- ✓ **hadolint** - Dockerfile best practices
- ✓ **shellcheck** - Shell script issues
- ✓ **eslint** - JavaScript/Vue code quality
- ✓ **pylint** - Python code quality
- ✓ **npm audit** - Security vulnerabilities
- ✓ **npm test** - Unit tests (skipped in fast mode)

## Status Symbols

- ✓ **PASS** (green) - Check succeeded
- ✗ **FAIL** (red) - Check failed, fix before pushing
- ⊘ **SKIP** (yellow) - Check not applicable or tool missing

## Dependencies

**Automatic (Recommended):**

```bash
make install-ci-deps
```

**Manual:**

```bash
sudo apt-get install -y shellcheck
wget -qO /tmp/hadolint https://github.com/hadolint/hadolint/releases/download/v2.12.0/hadolint-Linux-x86_64
sudo mv /tmp/hadolint /usr/local/bin/hadolint
sudo chmod +x /usr/local/bin/hadolint
pip3 install --user yamllint pylint
export PATH="$HOME/.local/bin:$PATH"
```

## Common Issues

### "Command not found"

Install missing dependencies (see above).

### Checks too slow

Use fast mode: `make ci-check-fast`

### Hook not running

Re-run setup: `make setup-hooks`

## Full Documentation

See [docs/local-ci-checks.md](../docs/local-ci-checks.md) for complete guide.
