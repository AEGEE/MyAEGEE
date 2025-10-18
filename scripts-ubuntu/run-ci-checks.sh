#!/usr/bin/env bash
#
# Run local CircleCI checks before pushing
# This script mimics what CircleCI does remotely, so you can catch issues early
#
# Usage:
#   ./scripts-ubuntu/run-ci-checks.sh           # Check all changed modules
#   ./scripts-ubuntu/run-ci-checks.sh --all     # Check all modules
#   ./scripts-ubuntu/run-ci-checks.sh core      # Check specific module(s)
#   ./scripts-ubuntu/run-ci-checks.sh --fast    # Skip slow checks (tests, docker builds)

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Options
CHECK_ALL=false
FAST_MODE=false
MODULES_TO_CHECK=()
FAILED_CHECKS=()
PASSED_CHECKS=()
SKIPPED_CHECKS=()

# Module detection
ALL_MODULES=(
    "core"
    "events"
    "frontend"
    "mailer"
    "discounts"
    "gsuite-wrapper"
    "statutory"
    "summeruniversity"
    "knowledge"
)

NODE_MODULES=(
    "core"
    "events"
    "frontend"
    "discounts"
    "gsuite-wrapper"
    "statutory"
    "summeruniversity"
    "knowledge"
)

# Print colored message
print_status() {
    local color=$1
    shift
    echo -e "${color}$*${NC}"
}

print_header() {
    echo ""
    print_status "$BLUE" "═══════════════════════════════════════════════════════"
    print_status "$BLUE" "$*"
    print_status "$BLUE" "═══════════════════════════════════════════════════════"
}

print_check() {
    local status=$1
    local check_name=$2
    local module=$3
    
    if [[ "$status" == "PASS" ]]; then
        print_status "$GREEN" "✓ $check_name [$module]"
        PASSED_CHECKS+=("$check_name [$module]")
    elif [[ "$status" == "FAIL" ]]; then
        print_status "$RED" "✗ $check_name [$module]"
        FAILED_CHECKS+=("$check_name [$module]")
    elif [[ "$status" == "SKIP" ]]; then
        print_status "$YELLOW" "⊘ $check_name [$module] (skipped)"
        SKIPPED_CHECKS+=("$check_name [$module]")
    fi
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Get changed modules (uncommitted + unpushed changes)
get_changed_modules() {
    local changed_modules=()
    
    # Get uncommitted changes
    local changed_files
    changed_files=$(git status --porcelain 2>/dev/null | awk '{print $2}')
    
    # Get unpushed commits
    local unpushed_files
    unpushed_files=$(git diff --name-only @{upstream}.. 2>/dev/null || echo "")
    
    # Combine and deduplicate
    local all_changed_files
    all_changed_files=$(echo -e "${changed_files}\n${unpushed_files}" | sort -u)
    
    # Extract module names from file paths
    for file in $all_changed_files; do
        for module in "${ALL_MODULES[@]}"; do
            if [[ "$file" == "${module}/"* ]]; then
                changed_modules+=("$module")
            fi
        done
        # Also check root-level files
        if [[ "$file" == scripts-* ]] || [[ "$file" == *.yml ]] || [[ "$file" == Makefile ]] || [[ "$file" == *.sh ]]; then
            changed_modules+=("root")
        fi
    done
    
    # Deduplicate
    printf '%s\n' "${changed_modules[@]}" | sort -u
}

# Check and report missing dependencies
check_dependencies() {
    print_header "Checking dependencies"
    
    local missing_deps=()
    local missing_python=()
    local can_auto_install=false
    
    # Check for package managers
    local has_apt=false
    local has_pip3=false
    
    if command_exists apt-get; then
        has_apt=true
    fi
    
    if command_exists pip3; then
        has_pip3=true
    fi
    
    # Check each dependency
    if ! command_exists shellcheck; then
        missing_deps+=("shellcheck")
    fi
    
    if ! command_exists hadolint; then
        missing_deps+=("hadolint")
    fi
    
    if ! command_exists yamllint; then
        missing_python+=("yamllint")
    fi
    
    if ! command_exists pylint; then
        missing_python+=("pylint")
    fi
    
    # Report status
    if [[ ${#missing_deps[@]} -eq 0 && ${#missing_python[@]} -eq 0 ]]; then
        print_status "$GREEN" "✓ All dependencies are installed"
        echo ""
        return 0
    fi
    
    # Show what's missing
    print_status "$YELLOW" "⚠ Missing dependencies detected:"
    echo ""
    
    for dep in "${missing_deps[@]}"; do
        print_status "$YELLOW" "  ✗ $dep"
    done
    
    for dep in "${missing_python[@]}"; do
        print_status "$YELLOW" "  ✗ $dep (Python package)"
    done
    
    echo ""
    
    # Offer to auto-install if possible
    if $has_apt && $has_pip3 && [[ ! -t 0 ]]; then
        # Non-interactive mode, just show instructions
        show_install_instructions
        return 1
    elif $has_apt && $has_pip3; then
        # Interactive mode, offer to install
        print_status "$BLUE" "Would you like to install missing dependencies now? [Y/n] "
        read -r response
        
        if [[ "$response" =~ ^[Nn]$ ]]; then
            echo ""
            show_install_instructions
            return 1
        else
            install_dependencies
            return $?
        fi
    else
        # Can't auto-install
        show_install_instructions
        return 1
    fi
}

# Show installation instructions
show_install_instructions() {
    print_status "$BLUE" "Installation Instructions"
    print_status "$BLUE" "========================"
    echo ""
    
    # Check what's missing and show relevant instructions
    if ! command_exists shellcheck; then
        print_status "$YELLOW" "Install shellcheck:"
        echo "  sudo apt-get update && sudo apt-get install -y shellcheck"
        echo ""
    fi
    
    if ! command_exists hadolint; then
        print_status "$YELLOW" "Install hadolint:"
        echo "  wget -qO /tmp/hadolint https://github.com/hadolint/hadolint/releases/download/v2.12.0/hadolint-Linux-x86_64"
        echo "  sudo mv /tmp/hadolint /usr/local/bin/hadolint"
        echo "  sudo chmod +x /usr/local/bin/hadolint"
        echo ""
    fi
    
    if ! command_exists yamllint || ! command_exists pylint; then
        print_status "$YELLOW" "Install Python linters:"
        if ! command_exists yamllint; then
            echo "  pip3 install --user yamllint"
        fi
        if ! command_exists pylint; then
            echo "  pip3 install --user pylint"
        fi
        echo ""
        print_status "$YELLOW" "Or install both at once:"
        echo "  pip3 install --user yamllint pylint"
        echo ""
    fi
    
    print_status "$BLUE" "Quick install (all at once):"
    echo "  sudo apt-get update && sudo apt-get install -y shellcheck"
    echo "  wget -qO /tmp/hadolint https://github.com/hadolint/hadolint/releases/download/v2.12.0/hadolint-Linux-x86_64 && \\"
    echo "    sudo mv /tmp/hadolint /usr/local/bin/hadolint && \\"
    echo "    sudo chmod +x /usr/local/bin/hadolint"
    echo "  pip3 install --user yamllint pylint"
    echo ""
    
    print_status "$YELLOW" "After installation, add pip packages to PATH if needed:"
    echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
    echo ""
    print_status "$YELLOW" "Or run the setup script which handles this automatically:"
    echo "  ./scripts-ubuntu/setup-git-hooks.sh"
    echo ""
}

# Auto-install missing dependencies
install_dependencies() {
    print_status "$BLUE" "Installing missing dependencies..."
    echo ""
    
    local install_failed=false
    
    # Install shellcheck via apt
    if ! command_exists shellcheck; then
        print_status "$YELLOW" "Installing shellcheck..."
        if sudo apt-get update >/dev/null 2>&1 && sudo apt-get install -y shellcheck >/dev/null 2>&1; then
            print_status "$GREEN" "✓ shellcheck installed"
        else
            print_status "$RED" "✗ Failed to install shellcheck"
            install_failed=true
        fi
    fi
    
    # Install hadolint
    if ! command_exists hadolint; then
        print_status "$YELLOW" "Installing hadolint..."
        if wget -qO /tmp/hadolint https://github.com/hadolint/hadolint/releases/download/v2.12.0/hadolint-Linux-x86_64 2>/dev/null && \
           sudo mv /tmp/hadolint /usr/local/bin/hadolint 2>/dev/null && \
           sudo chmod +x /usr/local/bin/hadolint 2>/dev/null; then
            print_status "$GREEN" "✓ hadolint installed"
        else
            print_status "$RED" "✗ Failed to install hadolint"
            install_failed=true
        fi
    fi
    
    # Install Python packages
    local python_packages=()
    if ! command_exists yamllint; then
        python_packages+=("yamllint")
    fi
    if ! command_exists pylint; then
        python_packages+=("pylint")
    fi
    
    if [[ ${#python_packages[@]} -gt 0 ]]; then
        print_status "$YELLOW" "Installing Python packages: ${python_packages[*]}..."
        if pip3 install --user "${python_packages[@]}" >/dev/null 2>&1; then
            print_status "$GREEN" "✓ Python packages installed"
            
            # Check if ~/.local/bin is in PATH
            if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
                print_status "$YELLOW" "⚠ Note: ~/.local/bin is not in your PATH"
                print_status "$YELLOW" "  Add this to your ~/.bashrc or ~/.zshrc:"
                echo "    export PATH=\"\$HOME/.local/bin:\$PATH\""
                echo ""
            fi
        else
            print_status "$RED" "✗ Failed to install Python packages"
            install_failed=true
        fi
    fi
    
    echo ""
    
    if $install_failed; then
        print_status "$RED" "Some dependencies failed to install. Please install manually."
        show_install_instructions
        return 1
    else
        print_status "$GREEN" "✓ All dependencies installed successfully!"
        echo ""
        
        # Verify all tools are now available
        local still_missing=false
        for cmd in shellcheck hadolint yamllint pylint; do
            if ! command_exists "$cmd"; then
                print_status "$RED" "✗ $cmd still not found in PATH"
                still_missing=true
            fi
        done
        
        if $still_missing; then
            print_status "$YELLOW" "⚠ Some tools were installed but are not in PATH yet."
            print_status "$YELLOW" "  You may need to:"
            echo "    1. Add ~/.local/bin to your PATH (for Python packages)"
            echo "    2. Open a new terminal session"
            echo "    3. Or run: export PATH=\"\$HOME/.local/bin:\$PATH\""
            echo ""
            return 1
        fi
        
        return 0
    fi
}

# Run yamllint on a module or root
run_yamllint() {
    local target=$1
    local yamllint_config=""
    
    if [[ "$target" == "root" ]]; then
        yamllint_config="${ROOT_DIR}/.yamllint.yml"
        target_dir="${ROOT_DIR}"
    else
        yamllint_config="${ROOT_DIR}/${target}/.yamllint.yml"
        target_dir="${ROOT_DIR}/${target}"
    fi
    
    if [[ ! -f "$yamllint_config" ]]; then
        print_check "SKIP" "yamllint" "$target"
        return 0
    fi
    
    if ! command_exists yamllint; then
        print_check "SKIP" "yamllint" "$target"
        return 0
    fi
    
    if yamllint -d "$yamllint_config" "$target_dir" >/dev/null 2>&1; then
        print_check "PASS" "yamllint" "$target"
        return 0
    else
        print_check "FAIL" "yamllint" "$target"
        yamllint -d "$yamllint_config" "$target_dir" 2>&1 | head -20
        return 1
    fi
}

# Run pylint on scripts
run_pylint() {
    if [[ ! -d "${ROOT_DIR}/scripts-server" ]]; then
        print_check "SKIP" "pylint" "root"
        return 0
    fi
    
    if ! command_exists pylint; then
        print_check "SKIP" "pylint" "root"
        return 0
    fi
    
    if pylint "${ROOT_DIR}/scripts-server" --disable C0114,C0116,W0511,E0401 >/dev/null 2>&1; then
        print_check "PASS" "pylint" "root"
        return 0
    else
        print_check "FAIL" "pylint" "root"
        pylint "${ROOT_DIR}/scripts-server" --disable C0114,C0116,W0511,E0401 2>&1 | head -20
        return 1
    fi
}

# Run hadolint on Dockerfiles
run_hadolint() {
    local module=$1
    local target_dir="${ROOT_DIR}/${module}"
    
    if [[ "$module" == "root" ]]; then
        target_dir="${ROOT_DIR}"
    fi
    
    if ! command_exists hadolint; then
        print_check "SKIP" "hadolint" "$module"
        return 0
    fi
    
    local dockerfiles
    dockerfiles=$(find "$target_dir" -name '*Dockerfile*' 2>/dev/null || echo "")
    
    if [[ -z "$dockerfiles" ]]; then
        print_check "SKIP" "hadolint" "$module"
        return 0
    fi
    
    local failed=false
    while IFS= read -r dockerfile; do
        if [[ -n "$dockerfile" ]]; then
            if ! hadolint "$dockerfile" >/dev/null 2>&1; then
                failed=true
            fi
        fi
    done <<< "$dockerfiles"
    
    if $failed; then
        print_check "FAIL" "hadolint" "$module"
        echo "$dockerfiles" | xargs hadolint 2>&1 | head -20
        return 1
    else
        print_check "PASS" "hadolint" "$module"
        return 0
    fi
}

# Run shellcheck on shell scripts
run_shellcheck() {
    local module=$1
    local target_dir="${ROOT_DIR}/${module}"
    
    if [[ "$module" == "root" ]]; then
        target_dir="${ROOT_DIR}"
    fi
    
    if ! command_exists shellcheck; then
        print_check "SKIP" "shellcheck" "$module"
        return 0
    fi
    
    local shell_scripts
    shell_scripts=$(find "$target_dir" -maxdepth 2 -name '*.sh' 2>/dev/null || echo "")
    
    if [[ -z "$shell_scripts" ]]; then
        print_check "SKIP" "shellcheck" "$module"
        return 0
    fi
    
    # Exclude some common issues that CircleCI also excludes
    if echo "$shell_scripts" | xargs shellcheck --exclude=SC2002,SC2086,SC2126,SC2154 >/dev/null 2>&1; then
        print_check "PASS" "shellcheck" "$module"
        return 0
    else
        print_check "FAIL" "shellcheck" "$module"
        echo "$shell_scripts" | xargs shellcheck --exclude=SC2002,SC2086,SC2126,SC2154 2>&1 | head -20
        return 1
    fi
}

# Run eslint on Node.js modules
run_eslint() {
    local module=$1
    local module_dir="${ROOT_DIR}/${module}"
    
    if [[ ! -f "${module_dir}/package.json" ]]; then
        print_check "SKIP" "eslint" "$module"
        return 0
    fi
    
    cd "$module_dir"
    
    # Check if node_modules exists
    if [[ ! -d "node_modules" ]]; then
        print_status "$YELLOW" "Installing npm dependencies for $module..."
        npm ci --quiet >/dev/null 2>&1 || npm install --quiet >/dev/null 2>&1
    fi
    
    # Check if lint script exists
    if ! grep -q '"lint"' package.json; then
        print_check "SKIP" "eslint" "$module"
        return 0
    fi
    
    if npm run lint >/dev/null 2>&1; then
        print_check "PASS" "eslint" "$module"
        return 0
    else
        print_check "FAIL" "eslint" "$module"
        npm run lint 2>&1 | head -30
        return 1
    fi
}

# Run npm audit
run_npm_audit() {
    local module=$1
    local module_dir="${ROOT_DIR}/${module}"
    
    if [[ ! -f "${module_dir}/package.json" ]]; then
        print_check "SKIP" "npm audit" "$module"
        return 0
    fi
    
    cd "$module_dir"
    
    if npm audit --production >/dev/null 2>&1; then
        print_check "PASS" "npm audit" "$module"
        return 0
    else
        print_check "FAIL" "npm audit" "$module"
        npm audit --production 2>&1 | head -30
        return 1
    fi
}

# Run tests for Node.js modules
run_tests() {
    local module=$1
    local module_dir="${ROOT_DIR}/${module}"
    
    if $FAST_MODE; then
        print_check "SKIP" "tests" "$module"
        return 0
    fi
    
    if [[ ! -f "${module_dir}/package.json" ]]; then
        print_check "SKIP" "tests" "$module"
        return 0
    fi
    
    cd "$module_dir"
    
    # Check if test script exists
    if ! grep -q '"test"' package.json; then
        print_check "SKIP" "tests" "$module"
        return 0
    fi
    
    # Check if node_modules exists
    if [[ ! -d "node_modules" ]]; then
        print_status "$YELLOW" "Installing npm dependencies for $module..."
        npm ci --quiet >/dev/null 2>&1 || npm install --quiet >/dev/null 2>&1
    fi
    
    print_status "$YELLOW" "Running tests for $module (this may take a while)..."
    
    if npm test >/dev/null 2>&1; then
        print_check "PASS" "tests" "$module"
        return 0
    else
        print_check "FAIL" "tests" "$module"
        npm test 2>&1 | tail -50
        return 1
    fi
}

# Run all checks for a module
run_module_checks() {
    local module=$1
    
    print_header "Checking module: $module"
    
    local checks_failed=0
    
    # Always run these linters
    run_yamllint "$module" || ((checks_failed++))
    run_hadolint "$module" || ((checks_failed++))
    run_shellcheck "$module" || ((checks_failed++))
    
    # Node.js specific checks
    if [[ " ${NODE_MODULES[*]} " =~ " ${module} " ]]; then
        run_eslint "$module" || ((checks_failed++))
        run_npm_audit "$module" || ((checks_failed++))
        run_tests "$module" || ((checks_failed++))
    fi
    
    return $checks_failed
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --all)
                CHECK_ALL=true
                shift
                ;;
            --fast)
                FAST_MODE=true
                shift
                ;;
            -h|--help)
                cat <<EOF
Usage: $0 [OPTIONS] [MODULES...]

Run local CircleCI checks before pushing.

OPTIONS:
    --all       Check all modules (not just changed ones)
    --fast      Skip slow checks (tests, docker builds)
    -h, --help  Show this help message

MODULES:
    Specific modules to check. If not provided, checks changed modules.
    Available modules: ${ALL_MODULES[*]}
    Special module: root (for root-level scripts and configs)

EXAMPLES:
    $0                  # Check changed modules
    $0 --all            # Check all modules
    $0 core events      # Check specific modules
    $0 --fast           # Quick checks only

EOF
                exit 0
                ;;
            *)
                MODULES_TO_CHECK+=("$1")
                shift
                ;;
        esac
    done
}

# Main execution
main() {
    cd "$ROOT_DIR"
    
    parse_args "$@"
    
    print_header "MyAEGEE Local CI Checks"
    
    # Determine which modules to check
    if [[ ${#MODULES_TO_CHECK[@]} -gt 0 ]]; then
        print_status "$BLUE" "Checking specified modules: ${MODULES_TO_CHECK[*]}"
    elif $CHECK_ALL; then
        MODULES_TO_CHECK=("root" "${ALL_MODULES[@]}")
        print_status "$BLUE" "Checking all modules"
    else
        mapfile -t MODULES_TO_CHECK < <(get_changed_modules)
        if [[ ${#MODULES_TO_CHECK[@]} -eq 0 ]]; then
            print_status "$GREEN" "No changed modules detected. Use --all to check everything."
            exit 0
        fi
        print_status "$BLUE" "Checking changed modules: ${MODULES_TO_CHECK[*]}"
    fi
    
    if $FAST_MODE; then
        print_status "$YELLOW" "Fast mode: skipping tests and docker builds"
    fi
    
    # Check and install dependencies
    if ! check_dependencies; then
        print_status "$YELLOW" "⚠ Some dependencies are missing."
        print_status "$YELLOW" "  Checks will be skipped for tools that are not installed."
        echo ""
        read -p "Continue anyway? [y/N] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "$YELLOW" "Exiting. Please install dependencies and try again."
            exit 1
        fi
        echo ""
    fi
    
    # Run root-level checks if needed
    if [[ " ${MODULES_TO_CHECK[*]} " =~ " root " ]]; then
        run_yamllint "root" || true
        run_pylint || true
        run_shellcheck "root" || true
    fi
    
    # Run checks for each module
    local total_failed=0
    for module in "${MODULES_TO_CHECK[@]}"; do
        if [[ "$module" != "root" ]]; then
            run_module_checks "$module" || ((total_failed++))
        fi
    done
    
    # Print summary
    print_header "Check Summary"
    
    if [[ ${#PASSED_CHECKS[@]} -gt 0 ]]; then
        print_status "$GREEN" "Passed: ${#PASSED_CHECKS[@]} checks"
    fi
    
    if [[ ${#SKIPPED_CHECKS[@]} -gt 0 ]]; then
        print_status "$YELLOW" "Skipped: ${#SKIPPED_CHECKS[@]} checks"
    fi
    
    if [[ ${#FAILED_CHECKS[@]} -gt 0 ]]; then
        print_status "$RED" "Failed: ${#FAILED_CHECKS[@]} checks"
        echo ""
        print_status "$RED" "The following checks failed:"
        for check in "${FAILED_CHECKS[@]}"; do
            print_status "$RED" "  - $check"
        done
        echo ""
        print_status "$RED" "Please fix these issues before pushing."
        exit 1
    else
        echo ""
        print_status "$GREEN" "✓ All checks passed! You're ready to push."
        exit 0
    fi
}

main "$@"
