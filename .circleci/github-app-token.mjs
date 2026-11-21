#!/usr/bin/env node
// Prints a short-lived (1 hour) GitHub App installation token for this
// repository, so semantic-release acts as the AEGEE release bot instead of a
// personal account.
//
// Usage: node .circleci/github-app-token.mjs
//
// Needs these CircleCI environment variables:
//   GITHUB_APP_ID          The App ID shown on the App's settings page.
//   GITHUB_APP_PRIVATE_KEY The App's private key: the .pem file base64-encoded
//                          (base64 -w0 key.pem), since CircleCI environment
//                          variables cannot hold multiple lines.
//
// The token is limited to this repository and to the permissions
// semantic-release needs: push tags and create releases (contents), and add
// the released-<service> labels to issues and pull requests.

import { createSign } from 'node:crypto';

const API = 'https://api.github.com';
const owner = process.env.CIRCLE_PROJECT_USERNAME || 'AEGEE';
const repo = process.env.CIRCLE_PROJECT_REPONAME || 'MyAEGEE';

function fail(message) {
  console.error(`github-app-token: ${message}`);
  process.exit(1);
}

function readPrivateKey() {
  const value = process.env.GITHUB_APP_PRIVATE_KEY;
  if (!value) fail('GITHUB_APP_PRIVATE_KEY is not set');
  if (value.includes('-----BEGIN')) return value.replace(/\\n/g, '\n');
  return Buffer.from(value, 'base64').toString('utf8');
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function createJwt(appId, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  // Backdate iat to allow for clock drift; GitHub accepts at most 10 minutes.
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: appId }));
  const signature = createSign('RSA-SHA256').update(`${header}.${payload}`).sign(privateKey, 'base64url');
  return `${header}.${payload}.${signature}`;
}

async function github(path, jwt, init = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${jwt}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'myaegee-release-ci',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) fail(`${init.method || 'GET'} ${path} returned ${response.status}: ${body.message || 'no message'}`);
  return body;
}

const appId = process.env.GITHUB_APP_ID;
if (!appId) fail('GITHUB_APP_ID is not set');

const jwt = createJwt(appId, readPrivateKey());
const installation = await github(`/repos/${owner}/${repo}/installation`, jwt);
const { token } = await github(`/app/installations/${installation.id}/access_tokens`, jwt, {
  method: 'POST',
  body: JSON.stringify({
    repositories: [repo],
    permissions: { contents: 'write', issues: 'write', pull_requests: 'write' },
  }),
});

process.stdout.write(token);
