#!/bin/sh
# Entrypoint of the frontend container when the stack runs without Traefik
# (MYAEGEE_GATEWAY=devserver). It serves the app with hot reload and proxies the
# API, media and CORS routes (see proxy.js).
set -eu

cd /usr/app/src

# node_modules lives in a named volume, so the host's node_modules (or a
# different platform's binaries) never leak in. Reinstall only when the lock
# file changed since the last install.
stamp=node_modules/.package-lock.sha256
wanted="$(sha256sum package-lock.json | cut -d ' ' -f 1)"
if [ ! -f "${stamp}" ] || [ "$(cat "${stamp}")" != "${wanted}" ]; then
    echo "[frontend] Installing dependencies (package-lock.json changed)"
    # npm ci can't remove node_modules itself because it's a mount point,
    # so empty it first.
    find node_modules -mindepth 1 -maxdepth 1 -exec rm -rf {} +
    npm ci --legacy-peer-deps --no-audit --no-fund
    echo "${wanted}" > "${stamp}"
fi

exec npx vue-cli-service serve --host 0.0.0.0 --port 8080
