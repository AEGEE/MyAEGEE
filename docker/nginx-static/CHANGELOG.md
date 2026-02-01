# Changelog - aegee/nginx-static

## [1.28.1] - 2026-02-01

### Changed
- Updated from nginx 1.17.0 (June 2019) to nginx 1.28.1 (latest stable)
- Updated base Alpine Linux from 3.9 to 3.23
- Migrated from pre-built Docker Hub image to building from scratch in CI
- Added multi-platform support (amd64 and arm64)

### Added
- Dockerfile for building the image
- CircleCI integration for automated builds on stable branch
- Documentation (README.md)
- Hadolint compliance for Dockerfile best practices

### Technical Details
- Base image: `nginx:1.28.1-alpine3.23`
- Image size: ~62 MB (vs 23.6 MB for old image, due to modern Alpine and nginx improvements)
- Platforms: linux/amd64, linux/arm64
- Tags: `1.28.1`, `stable`, `latest`

### Benefits
- 6 years of security patches and bug fixes
- Better performance
- Improved HTTP/2 support
- Modern TLS/SSL support
- Can now easily update to newer nginx versions
- Multi-architecture support for modern ARM servers

### Migration Notes
No configuration changes required. The image maintains the same functionality:
- curl available for healthchecks
- nginx runs on port 80
- Supports custom configuration via volume mounts
