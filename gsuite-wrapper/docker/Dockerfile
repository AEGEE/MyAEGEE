# Multi-platform support (linux/amd64, linux/arm64)
FROM --platform=$BUILDPLATFORM node:25-alpine

WORKDIR /usr/app/src

# Inject version from CI if provided (defaults to whatever is in package.json)
ARG PACKAGE_VERSION

# Copy only dependency manifests first to maximise layer caching.
# Rebuilds that only change source code will skip the npm ci step.
COPY package.json package-lock.json ./
RUN if [ -n "$PACKAGE_VERSION" ]; then npm version "$PACKAGE_VERSION" --no-git-tag-version --allow-same-version; fi \
 && npm ci --legacy-peer-deps

# Now copy the rest of the source
COPY . .

RUN chown -R node:node /usr/app

USER node

ENTRYPOINT ["npm"]
CMD ["start"]

EXPOSE 8084
