# Multi-platform support (linux/amd64, linux/arm64)
FROM --platform=$BUILDPLATFORM node:25-alpine

RUN mkdir -p /usr/app/src \
 && chown -R node:node /usr/app

WORKDIR /usr/app/src

# Inject version from CI if provided (defaults to whatever is in package.json)
ARG PACKAGE_VERSION

# Copy only dependency manifests first to maximise layer caching.
# Rebuilds that only change source code will skip the npm ci step.
COPY --chown=node:node package.json package-lock.json ./

USER node

RUN if [ -n "$PACKAGE_VERSION" ]; then npm version "$PACKAGE_VERSION" --no-git-tag-version --allow-same-version; fi \
 && npm ci --legacy-peer-deps --omit=dev

# Now copy the rest of the source
COPY --chown=node:node . .

ENTRYPOINT ["npm"]
CMD ["start"]

EXPOSE 8084
