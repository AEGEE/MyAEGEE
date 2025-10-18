#!/usr/bin/env bash
#
# Setup git hooks for MyAEGEE
# Installs pre-push hook that runs CI checks
#
# Usage: ./scripts-ubuntu/setup-git-hooks.sh

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
GIT_HOOKS_DIR="${ROOT_DIR}/.git/hooks"
SOURCE_HOOKS_DIR="${SCRIPT_DIR}/git-hooks"

echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  MyAEGEE Git Hooks Setup${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""

# Check if we're in a git repository
if [[ ! -d "${ROOT_DIR}/.git" ]]; then
    echo -e "${RED}Error: Not in a git repository${NC}"
    exit 1
fi

# Check if source hooks exist
if [[ ! -d "$SOURCE_HOOKS_DIR" ]]; then
    echo -e "${RED}Error: Git hooks directory not found at $SOURCE_HOOKS_DIR${NC}"
    exit 1
fi

# Install pre-push hook
echo -e "${YELLOW}Installing pre-push hook...${NC}"

if [[ -f "${GIT_HOOKS_DIR}/pre-push" ]]; then
    # Backup existing hook
    BACKUP="${GIT_HOOKS_DIR}/pre-push.backup.$(date +%Y%m%d_%H%M%S)"
    echo -e "${YELLOW}  Backing up existing pre-push hook to: ${BACKUP}${NC}"
    mv "${GIT_HOOKS_DIR}/pre-push" "$BACKUP"
fi

# Copy the new hook
cp "${SOURCE_HOOKS_DIR}/pre-push" "${GIT_HOOKS_DIR}/pre-push"
chmod +x "${GIT_HOOKS_DIR}/pre-push"

echo -e "${GREEN}✓ Pre-push hook installed${NC}"
echo ""

# Check for required dependencies
echo -e "${YELLOW}Checking dependencies...${NC}"

MISSING_DEPS=()

if ! command -v shellcheck >/dev/null 2>&1; then
    MISSING_DEPS+=("shellcheck")
fi

if ! command -v hadolint >/dev/null 2>&1; then
    MISSING_DEPS+=("hadolint")
fi

if ! command -v yamllint >/dev/null 2>&1; then
    MISSING_DEPS+=("yamllint")
fi

if ! command -v pylint >/dev/null 2>&1; then
    MISSING_DEPS+=("pylint")
fi

if [[ ${#MISSING_DEPS[@]} -gt 0 ]]; then
    echo -e "${YELLOW}The following dependencies are missing:${NC}"
    for dep in "${MISSING_DEPS[@]}"; do
        echo -e "${YELLOW}  - $dep${NC}"
    done
    echo ""
    echo -e "${BLUE}Would you like to install them now? [Y/n]${NC}"
    read -r response
    
    if [[ ! "$response" =~ ^[Nn]$ ]]; then
        echo ""
        if [[ -x "${SCRIPT_DIR}/install-ci-dependencies.sh" ]]; then
            "${SCRIPT_DIR}/install-ci-dependencies.sh"
            install_exit=$?
            if [[ $install_exit -ne 0 ]]; then
                echo ""
                echo -e "${YELLOW}Some dependencies failed to install.${NC}"
                echo -e "${YELLOW}You can continue, but some checks will be skipped.${NC}"
                echo ""
            fi
        else
            echo -e "${RED}Error: install-ci-dependencies.sh not found${NC}"
            echo ""
            echo -e "${YELLOW}Install manually with:${NC}"
            echo ""
            echo -e "  ${BLUE}# Quick install script${NC}"
            echo -e "  ./scripts-ubuntu/install-ci-dependencies.sh"
            echo ""
            echo -e "  ${BLUE}# Or manual installation${NC}"
            echo -e "  sudo apt-get install -y shellcheck"
            echo -e "  wget -qO /tmp/hadolint https://github.com/hadolint/hadolint/releases/download/v2.12.0/hadolint-Linux-x86_64"
            echo -e "  sudo mv /tmp/hadolint /usr/local/bin/hadolint"
            echo -e "  sudo chmod +x /usr/local/bin/hadolint"
            echo -e "  pip3 install --user yamllint pylint"
            echo ""
        fi
    else
        echo ""
        echo -e "${YELLOW}Skipping dependency installation.${NC}"
        echo -e "${YELLOW}You can install them later with:${NC}"
        echo ""
        echo -e "  ${BLUE}./scripts-ubuntu/install-ci-dependencies.sh${NC}"
        echo ""
    fi
else
    echo -e "${GREEN}✓ All dependencies installed${NC}"
    echo ""
fi

# Show usage
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Setup complete!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Usage:${NC}"
echo ""
echo -e "  ${BLUE}# The pre-push hook will run automatically when you push${NC}"
echo -e "  git push"
echo ""
echo -e "  ${BLUE}# To bypass the hook temporarily${NC}"
echo -e "  git push --no-verify"
echo ""
echo -e "  ${BLUE}# Run CI checks manually${NC}"
echo -e "  ./scripts-ubuntu/run-ci-checks.sh"
echo ""
echo -e "  ${BLUE}# Run CI checks on all modules${NC}"
echo -e "  ./scripts-ubuntu/run-ci-checks.sh --all"
echo ""
echo -e "  ${BLUE}# Run fast checks only (skip tests)${NC}"
echo -e "  ./scripts-ubuntu/run-ci-checks.sh --fast"
echo ""
echo -e "  ${BLUE}# Check specific modules${NC}"
echo -e "  ./scripts-ubuntu/run-ci-checks.sh core events"
echo ""

# Optional: Run initial check
read -p "Would you like to run an initial CI check now? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    "${SCRIPT_DIR}/run-ci-checks.sh" --fast
fi
