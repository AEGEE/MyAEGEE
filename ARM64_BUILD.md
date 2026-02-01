# ARM64 Multi-Architecture Docker Support

This document describes how to build and run MyAEGEE Docker images on ARM64 architecture (Apple Silicon, Raspberry Pi, ARM-based servers, etc.).

## What Changed

All Dockerfiles have been updated to support multi-platform builds using Docker Buildx. The following changes were made:

1. **Platform-aware base images**: All `FROM` statements now use `--platform=$BUILDPLATFORM` or `--platform=$TARGETPLATFORM` flags
2. **Multi-architecture support**: Images can now be built for both `linux/amd64` and `linux/arm64`

## Updated Services

The following services now support ARM64:

- **Node.js-based services**: core, network, events, statutory, summeruniversity, knowledge, discounts, gsuite-wrapper
- **Frontend**: Multi-stage build with nginx
- **Mailer**: Elixir-based service
- **Mail Transfer Agent**: Alpine-based postfix service
- **Portal**: PHP Apache service
- **Logstash**: Elasticsearch logstash service

## Building for ARM64

### Prerequisites

1. **Docker Buildx**: Ensure you have Docker Buildx installed (included in Docker Desktop and recent Docker Engine versions)

```bash
# Check if buildx is available
docker buildx version
```

2. **Create a multi-platform builder** (one-time setup):

```bash
docker buildx create --name myaegee-builder --use
docker buildx inspect --bootstrap
```

### Building Individual Services

To build a service for ARM64:

```bash
# Navigate to the service directory
cd core/docker

# Build for ARM64 only
docker buildx build --platform linux/arm64 -t aegee/core:arm64 -f core/Dockerfile ../..

# Build for both AMD64 and ARM64
docker buildx build --platform linux/amd64,linux/arm64 -t aegee/core:latest -f core/Dockerfile ../..
```

### Building All Services

To build all services with ARM64 support, you can modify the `helper.sh` script or use buildx directly:

```bash
# Build all services for current platform (auto-detects ARM64 or AMD64)
docker buildx build --platform linux/arm64 .

# Build for multiple platforms
docker buildx build --platform linux/amd64,linux/arm64 .
```

### Using docker-compose with Buildx

When using `docker-compose`, you can specify the platform:

```bash
# Build and run for ARM64
DOCKER_DEFAULT_PLATFORM=linux/arm64 docker-compose build
DOCKER_DEFAULT_PLATFORM=linux/arm64 docker-compose up
```

Alternatively, add to your `.env` file:

```bash
DOCKER_DEFAULT_PLATFORM=linux/arm64
```

## Platform Variables Explained

- `$BUILDPLATFORM`: The platform of the machine running the build (e.g., `linux/arm64` on Apple Silicon)
- `$TARGETPLATFORM`: The platform you're building for (e.g., `linux/amd64` for production servers)

Most services use `--platform=$BUILDPLATFORM` to ensure native builds are fast. For the nginx stage in frontend, we use `--platform=$TARGETPLATFORM` to ensure the final runtime image matches the target architecture.

## Testing ARM64 Builds

### On Apple Silicon (M1/M2/M3)

```bash
# Build and run natively
./start.sh

# Or with docker-compose directly
make build
make start
```

### On AMD64 with ARM64 Emulation

```bash
# Install QEMU for ARM64 emulation
docker run --privileged --rm tonistiigi/binfmt --install arm64

# Build and run ARM64 images
DOCKER_DEFAULT_PLATFORM=linux/arm64 make build
DOCKER_DEFAULT_PLATFORM=linux/arm64 make start
```

## CI/CD Considerations

For building multi-architecture images in CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Set up Docker Buildx
  uses: docker/setup-buildx-action@v2

- name: Build and push
  uses: docker/build-push-action@v4
  with:
    context: .
    platforms: linux/amd64,linux/arm64
    push: true
    tags: aegee/core:latest
```

## Performance Notes

1. **Native builds are faster**: Building on the same architecture you're targeting is always faster
2. **Cross-compilation**: Building ARM64 on AMD64 (or vice versa) uses QEMU emulation and can be significantly slower
3. **Multi-stage builds**: The frontend service uses multi-stage builds which are optimized for both platforms

## Troubleshooting

### "exec format error"

This error occurs when trying to run an image built for a different architecture. Solutions:

1. Rebuild for the correct platform: `--platform linux/arm64` or `--platform linux/amd64`
2. Enable QEMU emulation (see above)

### Slow build times on cross-compilation

This is expected when building for a different architecture. Options:

1. Build natively on the target architecture
2. Use a multi-architecture builder instance
3. Enable layer caching with buildx

### Image not found for architecture

Some base images may not support ARM64. All base images used in MyAEGEE (node, nginx, alpine, php, elixir) officially support ARM64.

## Migration Path

For existing deployments:

1. **Development**: Simply rebuild on ARM64 machines (e.g., Apple Silicon laptops)
2. **Production**: 
   - Continue using AMD64 images (no changes required)
   - OR rebuild images with `--platform linux/amd64` explicitly
   - OR build multi-arch images and push to registry

## Additional Resources

- [Docker Buildx Documentation](https://docs.docker.com/buildx/working-with-buildx/)
- [Multi-platform Images](https://docs.docker.com/build/building/multi-platform/)
- [Docker Build Cloud](https://docs.docker.com/build/cloud/)
