#!/usr/bin/env bash
#
# Install dependencies for local CI checks
# This script installs all required linting and checking tools
#
# Usage: ./scripts-ubuntu/install-ci-dependencies.sh

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Print colored message
print_status() {
    local color=$1
    shift
    echo -e "${color}$*${NC}"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Installing CI Dependencies${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""

# Check system requirements
if ! command_exists apt-get; then
    print_status "$RED" "Error: This script requires apt-get (Debian/Ubuntu)"
    print_status "$RED" "Please install dependencies manually:"
    echo ""
    echo "Required tools:"
    echo "  - shellcheck"
    echo "  - hadolint"
    echo "  - yamllint (pip3)"
    echo "  - pylint (pip3)"
    exit 1
fi

if ! command_exists pip3; then
    print_status "$YELLOW" "pip3 not found. Installing python3-pip..."
    sudo apt-get update
    sudo apt-get install -y python3-pip
fi

# Track installation status
FAILED_INSTALLS=()
SUCCESSFUL_INSTALLS=()
ALREADY_INSTALLED=()

# Install shellcheck
echo ""
print_status "$BLUE" "Checking shellcheck..."
if command_exists shellcheck; then
    print_status "$GREEN" "✓ shellcheck already installed"
    ALREADY_INSTALLED+=("shellcheck")
else
    print_status "$YELLOW" "Installing shellcheck..."
    if sudo apt-get update >/dev/null 2>&1 && sudo apt-get install -y shellcheck >/dev/null 2>&1; then
        print_status "$GREEN" "✓ shellcheck installed successfully"
        SUCCESSFUL_INSTALLS+=("shellcheck")
    else
        print_status "$RED" "✗ Failed to install shellcheck"
        FAILED_INSTALLS+=("shellcheck")
    fi
fi

# Install hadolint
echo ""
print_status "$BLUE" "Checking hadolint..."
if command_exists hadolint; then
    print_status "$GREEN" "✓ hadolint already installed"
    ALREADY_INSTALLED+=("hadolint")
else
    print_status "$YELLOW" "Installing hadolint..."
    HADOLINT_VERSION="v2.12.0"
    HADOLINT_URL="https://github.com/hadolint/hadolint/releases/download/${HADOLINT_VERSION}/hadolint-Linux-x86_64"
    
    if wget -qO /tmp/hadolint "$HADOLINT_URL" 2>/dev/null && \
       sudo mv /tmp/hadolint /usr/local/bin/hadolint 2>/dev/null && \
       sudo chmod +x /usr/local/bin/hadolint 2>/dev/null; then
        print_status "$GREEN" "✓ hadolint installed successfully"
        SUCCESSFUL_INSTALLS+=("hadolint")
    else
        print_status "$RED" "✗ Failed to install hadolint"
        print_status "$YELLOW" "  Try manually:"
        echo "    wget -qO /tmp/hadolint $HADOLINT_URL"
        echo "    sudo mv /tmp/hadolint /usr/local/bin/hadolint"
        echo "    sudo chmod +x /usr/local/bin/hadolint"
        FAILED_INSTALLS+=("hadolint")
    fi
fi

# Install Python linting tools
echo ""
print_status "$BLUE" "Checking Python linting tools..."

PYTHON_PACKAGES=()
if ! command_exists yamllint; then
    PYTHON_PACKAGES+=("yamllint")
fi
if ! command_exists pylint; then
    PYTHON_PACKAGES+=("pylint")
fi

if [[ ${#PYTHON_PACKAGES[@]} -eq 0 ]]; then
    print_status "$GREEN" "✓ yamllint and pylint already installed"
    ALREADY_INSTALLED+=("yamllint" "pylint")
else
    print_status "$YELLOW" "Installing Python packages: ${PYTHON_PACKAGES[*]}..."
    
    if pip3 install --user "${PYTHON_PACKAGES[@]}" 2>&1 | grep -q "Successfully installed"; then
        print_status "$GREEN" "✓ Python packages installed successfully"
        SUCCESSFUL_INSTALLS+=("${PYTHON_PACKAGES[@]}")
        
        # Check PATH
        if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
            echo ""
            print_status "$YELLOW" "⚠ Important: Add Python packages to your PATH"
            echo ""
            print_status "$YELLOW" "Add this line to your ~/.bashrc or ~/.zshrc:"
            echo ""
            print_status "$BLUE" "  export PATH=\"\$HOME/.local/bin:\$PATH\""
            echo ""
            print_status "$YELLOW" "Then run:"
            echo "  source ~/.bashrc"
            echo ""
            print_status "$YELLOW" "Or for immediate effect in current shell:"
            echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
            echo ""
        fi
    else
        print_status "$RED" "✗ Failed to install Python packages"
        print_status "$YELLOW" "  Try manually:"
        echo "    pip3 install --user ${PYTHON_PACKAGES[*]}"
        FAILED_INSTALLS+=("${PYTHON_PACKAGES[@]}")
    fi
fi

# Install Node.js tools (optional, project-specific)
echo ""
print_status "$BLUE" "Checking Node.js..."
if command_exists npm; then
    print_status "$GREEN" "✓ npm found (required for eslint in modules)"
    
    # Check if we're in a module directory with package.json
    if [[ -f "package.json" ]]; then
        print_status "$YELLOW" "Found package.json. Run 'npm install' to get module-specific linters."
    fi
else
    print_status "$YELLOW" "⊘ npm not found (needed for JavaScript linting)"
    print_status "$YELLOW" "  Node.js modules will be skipped in CI checks"
    print_status "$YELLOW" "  To install Node.js:"
    echo "    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -"
    echo "    sudo apt-get install -y nodejs"
fi

# Summary
echo ""
print_status "$BLUE" "═══════════════════════════════════════════════════════${NC}"
print_status "$BLUE" "  Installation Summary${NC}"
print_status "$BLUE" "═══════════════════════════════════════════════════════${NC}"
echo ""

if [[ ${#ALREADY_INSTALLED[@]} -gt 0 ]]; then
    print_status "$GREEN" "Already installed (${#ALREADY_INSTALLED[@]}):"
    for pkg in "${ALREADY_INSTALLED[@]}"; do
        echo "  ✓ $pkg"
    done
    echo ""
fi

if [[ ${#SUCCESSFUL_INSTALLS[@]} -gt 0 ]]; then
    print_status "$GREEN" "Successfully installed (${#SUCCESSFUL_INSTALLS[@]}):"
    for pkg in "${SUCCESSFUL_INSTALLS[@]}"; do
        echo "  ✓ $pkg"
    done
    echo ""
fi

if [[ ${#FAILED_INSTALLS[@]} -gt 0 ]]; then
    print_status "$RED" "Failed to install (${#FAILED_INSTALLS[@]}):"
    for pkg in "${FAILED_INSTALLS[@]}"; do
        echo "  ✗ $pkg"
    done
    echo ""
    print_status "$RED" "Some installations failed. Please install manually."
    exit 1
fi

# Verify all tools are accessible
echo ""
print_status "$BLUE" "Verifying installations..."
echo ""

ALL_GOOD=true
for tool in shellcheck hadolint yamllint pylint; do
    if command_exists "$tool"; then
        VERSION=$($tool --version 2>&1 | head -1 || echo "unknown")
        print_status "$GREEN" "✓ $tool: $VERSION"
    else
        print_status "$RED" "✗ $tool: not found in PATH"
        ALL_GOOD=false
    fi
done

echo ""

if $ALL_GOOD; then
    print_status "$GREEN" "═══════════════════════════════════════════════════════"
    print_status "$GREEN" "✓ All dependencies installed successfully!"
    print_status "$GREEN" "═══════════════════════════════════════════════════════"
    echo ""
    print_status "$BLUE" "Next steps:"
    echo "  1. Set up git hooks: ./scripts-ubuntu/setup-git-hooks.sh"
    echo "  2. Run CI checks: ./scripts-ubuntu/run-ci-checks.sh"
    echo "  3. Or use Make: make ci-check"
    echo ""
    exit 0
else
    print_status "$YELLOW" "═══════════════════════════════════════════════════════"
    print_status "$YELLOW" "⚠ Some tools are not in your PATH"
    print_status "$YELLOW" "═══════════════════════════════════════════════════════"
    echo ""
    print_status "$YELLOW" "If you just installed Python packages, you may need to:"
    echo "  1. Add ~/.local/bin to PATH:"
    echo "     export PATH=\"\$HOME/.local/bin:\$PATH\""
    echo "  2. Open a new terminal session"
    echo ""
    exit 1
fi
