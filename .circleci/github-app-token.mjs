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
// The token is limited to this repository and to contents, which is all
// semantic-release does here: push tags and create GitHub releases. (Our
// .releaserc files turn off success and fail comments, and @semantic-release/github
// only adds the released-<module> labels together with success comments.)

import { createSign } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

const API = 'https://api.github.com';
const ATTEMPTS = 3;
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
  let signature;
  try {
    signature = createSign('RSA-SHA256').update(`${header}.${payload}`).sign(privateKey, 'base64url');
  } catch (error) {
    fail(`GITHUB_APP_PRIVATE_KEY is not a valid private key (${error.code || error.message}). Set it to the output of base64 -w0 key.pem`);
  }
  return `${header}.${payload}.${signature}`;
}

// Calls the GitHub API, retrying network errors and 5xx responses.
async function github(path, jwt, init = {}) {
  const request = `${init.method || 'GET'} ${path}`;
  for (let attempt = 1; ; attempt++) {
    let problem;
    try {
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
      if (response.ok) return body;
      problem = `${request} returned ${response.status}: ${body.message || 'no message'}`;
      if (response.status < 500) fail(problem);
    } catch (error) {
      problem = `${request} failed: ${error.cause?.code || error.cause?.message || error.message}`;
    }
    if (attempt === ATTEMPTS) fail(problem);
    console.error(`github-app-token: ${problem}; retrying`);
    await sleep(2000 * attempt);
  }
}

const appId = (process.env.GITHUB_APP_ID || '').trim();
if (!appId) fail('GITHUB_APP_ID is not set');

const jwt = createJwt(appId, readPrivateKey());
const installation = await github(`/repos/${owner}/${repo}/installation`, jwt);
const { token } = await github(`/app/installations/${installation.id}/access_tokens`, jwt, {
  method: 'POST',
  body: JSON.stringify({
    repositories: [repo],
    permissions: { contents: 'write' },
  }),
});

process.stdout.write(token);
