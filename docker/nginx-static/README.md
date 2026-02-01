# aegee/nginx-static

A minimal static file server based on nginx, used across MyAEGEE services to serve static files and media.

## Base Image

- **nginx:1.28.1-alpine3.23** (stable version)
- Based on Alpine Linux 3.23 for minimal image size

## What's Included

- nginx 1.28.1 (stable release)
- curl (for healthcheck endpoints)

## Usage

This image is designed to be used with custom nginx configurations mounted at runtime.

### Example (docker-compose.yml)

```yaml
services:
  static:
    image: aegee/nginx-static:latest
    volumes:
      - ./media:/usr/app/media:ro
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./sites/default:/etc/nginx/sites-available/default:ro
    expose:
      - "80"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:80/healthcheck"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## Building

### Local Build

```bash
docker build -t aegee/nginx-static:latest docker/nginx-static/
```

### CI/CD Build

The image is automatically built and pushed to Docker Hub when changes are merged to the `stable` branch via CircleCI. The build creates multi-platform images (amd64 and arm64) with the following tags:

- `aegee/nginx-static:1.28.1` - Version-specific tag
- `aegee/nginx-static:stable` - Stable release tag
- `aegee/nginx-static:latest` - Latest release tag

## Updating nginx Version

To update to a newer nginx version:

1. Check available versions at https://hub.docker.com/_/nginx
2. Update the `FROM` line in `docker/nginx-static/Dockerfile`
3. Update the version tags in `.circleci/config.yml` (search for `nginx-static-docker-build-and-push`)
4. Update this README with the new version
5. Test the build locally
6. Commit changes and merge to `stable` branch

## Migration from Previous Version

The previous version used nginx 1.17.0 (from 2019). This version updates to nginx 1.28.1, which includes:

- Security fixes and patches
- Performance improvements
- Bug fixes
- Better HTTP/2 support

No configuration changes should be required for basic static file serving.
