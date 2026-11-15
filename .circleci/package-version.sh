#!/bin/bash
# Prints the version to build and tag a service's Docker image with.
#
# Usage: .circleci/package-version.sh <service>
#
# When HEAD carries the service's newest release tag (semantic-release just
# released it), this prints that version, e.g. "1.14.1".
# Otherwise it prints the newest version plus the commit, e.g. "1.14.1-g61b6c72",
# so a build without a release never overwrites an existing version tag on
# Docker Hub.

set -euo pipefail

service="${1:?Usage: package-version.sh <service>}"

# Only tags HEAD descends from, so rebuilding an older commit (e.g. rerunning a
# release pipeline after a newer release) still finds its own release.
tags="$(git tag --merged HEAD --list "${service}@*" --sort=-v:refname)"
latest_tag="${tags%%$'\n'*}"

if [[ -z "${latest_tag}" ]]; then
  echo "No ${service}@* release tag found" >&2
  exit 1
fi

version="${latest_tag#"${service}@"}"

if [[ -n "$(git tag --points-at HEAD --list "${latest_tag}")" ]]; then
  echo "${version}"
else
  echo "${version}-g$(git rev-parse --short=7 HEAD)"
fi
