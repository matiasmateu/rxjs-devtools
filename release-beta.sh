#!/bin/bash

# RxJS DevTools Beta Release Script
# This script: increments beta versions, builds packages, commits changes, and publishes

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Function to increment beta version
increment_beta_version() {
    local package_json="$1"
    local current_version=$(node -p "require('$package_json').version")
    
    # Extract version parts
    if [[ $current_version =~ ^([0-9]+\.[0-9]+\.[0-9]+)-beta\.([0-9]+)$ ]]; then
        local base_version="${BASH_REMATCH[1]}"
        local beta_number="${BASH_REMATCH[2]}"
        local new_beta_number=$((beta_number + 1))
        local new_version="${base_version}-beta.${new_beta_number}"
    else
        print_error "Invalid version format in $package_json: $current_version"
        return 1
    fi
    
    # Update package.json
    node -e "
        const fs = require('fs');
        const pkg = require('$package_json');
        pkg.version = '$new_version';
        fs.writeFileSync('$package_json', JSON.stringify(pkg, null, 2) + '\n');
    "
    
    echo "$new_version"
}

# Function to build packages
build_packages() {
    print_step "Building packages"
    
    # Build React package
    if [ -d "packages/rxjs-devtools-react" ]; then
        print_step "Building React package"
        cd packages/rxjs-devtools-react
        yarn build
        cd ../..
        print_success "React package built"
    fi
    
    # Build Chrome extension
    if [ -d "packages/rxjs-devtools-chrome-extension" ]; then
        print_step "Building Chrome extension"
        cd packages/rxjs-devtools-chrome-extension
        yarn build
        cd ../..
        print_success "Chrome extension built"
    fi
}

# Function to check if we're in a git repository
check_git_repo() {
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        print_error "Not in a git repository"
        exit 1
    fi
}

# Function to check for uncommitted changes
check_git_status() {
    if ! git diff-index --quiet HEAD --; then
        print_warning "You have uncommitted changes. Please commit or stash them first."
        git status --porcelain
        read -p "Do you want to continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_error "Aborting release"
            exit 1
        fi
    fi
}

# Function to commit changes
commit_changes() {
    local version_info="$1"
    
    print_step "Committing changes"
    
    git add .
    git commit -m "chore: release beta versions

$version_info"
    
    print_success "Changes committed"
}

# Function to create git tag
create_git_tag() {
    local tag_name="beta-$(date +%Y%m%d-%H%M%S)"
    
    print_step "Creating git tag: $tag_name"
    git tag -a "$tag_name" -m "Beta release $tag_name"
    print_success "Git tag created: $tag_name"
    
    echo "$tag_name"
}

# Function to publish packages
publish_packages() {
    print_step "Publishing packages"
    
    # Publish React package
    if [ -d "packages/rxjs-devtools-react" ]; then
        print_step "Publishing React package"
        cd packages/rxjs-devtools-react
        if npm publish --tag beta; then
            print_success "React package published"
        else
            print_error "Failed to publish React package"
            cd ../..
            return 1
        fi
        cd ../..
    fi
    
    # Note: Chrome extension is not published to npm, but we can package it
    if [ -d "packages/rxjs-devtools-chrome-extension" ]; then
        print_step "Packaging Chrome extension"
        cd packages/rxjs-devtools-chrome-extension
        if yarn package; then
            print_success "Chrome extension packaged"
        else
            print_warning "Failed to package Chrome extension"
        fi
        cd ../..
    fi
}

# Main execution
main() {
    print_step "Starting beta release process"
    
    # Check prerequisites
    check_git_repo
    check_git_status
    
    # Ensure we're in the root directory
    if [ ! -f "package.json" ] || [ ! -d "packages" ]; then
        print_error "Please run this script from the project root directory"
        exit 1
    fi
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        print_step "Installing dependencies"
        yarn install
    fi
    
    # Track version changes
    local version_info=""
    
    # Increment versions for all publishable packages
    print_step "Incrementing beta versions"
    
    for package_dir in packages/*/; do
        if [ -f "${package_dir}package.json" ]; then
            local package_json="${package_dir}package.json"
            local package_name=$(node -p "require('$package_json').name")
            local is_private=$(node -p "require('$package_json').private || false")
            
            if [ "$is_private" = "false" ]; then
                print_step "Updating version for $package_name"
                local new_version=$(increment_beta_version "$package_json")
                print_success "$package_name: $new_version"
                version_info="$version_info\n- $package_name: $new_version"
            fi
        fi
    done
    
    # Build packages
    build_packages
    
    # Commit changes
    commit_changes "$version_info"
    
    # Create git tag
    local tag_name=$(create_git_tag)
    
    # Ask for confirmation before publishing
    echo -e "\n${YELLOW}Ready to publish the following packages:${NC}"
    echo -e "$version_info"
    echo -e "\nGit tag: $tag_name"
    
    read -p "Do you want to publish these packages? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        publish_packages
        
        print_success "Beta release completed successfully!"
        print_step "Summary"
        echo -e "Versions updated:$version_info"
        echo -e "Git tag: $tag_name"
        echo -e "\n${GREEN}Don't forget to push your changes and tags:${NC}"
        echo -e "  git push origin main"
        echo -e "  git push origin $tag_name"
    else
        print_warning "Publishing skipped. You can run the publish step manually later."
        print_step "To publish manually, run:"
        echo -e "  cd packages/rxjs-devtools-react && npm publish --tag beta"
    fi
}

# Run main function
main "$@"
