# Contributing to MyAEGEE

## Commit Message Guidelines

We use [Conventional Commits](https://www.conventionalcommits.org/) with MANDATORY scopes.

### Format

```
<type>(<scope>): <subject>
<BLANK LINE>
<body>
<BLANK LINE>
<footer>
```

### Scopes

**Module scopes** (use when changing a specific module):
- `core`, `events`, `frontend`, `discounts`, `knowledge`
- `network`, `statutory`, `summeruniversity`, `mailer`

**Infrastructure scopes** (use for CI/Docker/root-level changes):
- `ci` - CircleCI configuration
- `docker` - Docker compose or Dockerfiles
- `deps` - Root-level dependencies
- `monorepo` - Monorepo-wide changes
- `docs` - Documentation

### Examples

```bash
# Adding a feature to core module
git commit -m "feat(core): add OAuth2 authentication support"

# Fixing a bug in frontend
git commit -m "fix(frontend): resolve infinite scroll pagination"

# Updating CI configuration (triggers all modules)
git commit -m "chore(ci): upgrade CircleCI Node image to 22.20"

# Documentation change
git commit -m "docs(readme): add API documentation link"

# Breaking change
git commit -m "feat(core)!: migrate to PostgreSQL 17

BREAKING CHANGE: PostgreSQL 15 is no longer supported"
```

### Commit Validation

Commits are validated by `commitlint` via a git hook. If your commit fails validation:

```bash
# Error example
⧗   input: fix: something
✖   subject may not be empty [scope-empty]

# Fix by adding scope
git commit -m "fix(core): something"
```

## Release Process

### Automated Releases

This monorepo uses **independent versioning** with `semantic-release-monorepo` - each module releases independently when it has changes.

**How it works:**
- The `semantic-release-monorepo` plugin filters commits to only analyze changes affecting each specific module
- Only commits that touch a module's directory or have the module's scope trigger a release
- This prevents unnecessary releases when unrelated modules change

**Workflow:**
1. Create feature branch from `stable`
2. Make changes with properly scoped commits
3. Push and create Pull Request
4. After PR approval and merge, CI automatically:
   - Determines affected modules based on commit paths and scopes
   - Runs semantic-release for each affected module
   - Creates version tags (e.g., `core@1.40.2`)
   - Updates CHANGELOGs
   - Builds and pushes Docker images
   - Creates GitHub releases

### Release bot credentials

semantic-release does not use a personal account. Tags, GitHub releases and `released-<module>` labels are made by the **AEGEE Release Bot** GitHub App:

- App settings (AEGEE organization owners only): https://github.com/organizations/AEGEE/settings/apps/aegee-release-bot
- App ID: `5863453`
- Installed on `AEGEE/MyAEGEE` only, with repository permissions Contents, Issues and Pull requests (read and write). It needs no webhook.

**Where the credential is:** only in the CircleCI project environment variables (https://app.circleci.com/settings/project/github/AEGEE/MyAEGEE/environment-variables):

| Variable | Value |
|----------|-------|
| `GITHUB_APP_ID` | `5863453` |
| `GITHUB_APP_PRIVATE_KEY` | The App's private key (`.pem`), base64-encoded on one line, because CircleCI variables cannot hold multiple lines |

The private key is deliberately not kept anywhere else, such as a password manager. If it is lost, generate a new one. In each release job, `.circleci/github-app-token.mjs` uses the key to get an installation token that lasts one hour and only works on this repository.

**Regenerate the key** (when it is lost or leaked, or when someone who had it leaves):

1. On the App settings page, under **Private keys**, click **Generate a private key**. The `.pem` file downloads.
2. Encode it on one line: `base64 -w0 aegee-release-bot.*.private-key.pem` (on macOS: `base64 -i <file>`).
3. In CircleCI, replace the value of `GITHUB_APP_PRIVATE_KEY` with the output.
4. Back on the App settings page, delete the old key.
5. Delete the downloaded `.pem` file.
6. The next release job on `stable` shows whether it works. To check straight away, rerun the last `*-docker-build-and-push` job on `stable` in CircleCI. semantic-release creates nothing when there is nothing new to release, but the job does build and push that module's Docker image again under the same version.

**Revoke access straight away** (for example after a leak): delete the key on the App settings page. Tokens made before that keep working for up to an hour. To stop those too, suspend the App's installation: AEGEE organization settings, **GitHub Apps**, **AEGEE Release Bot**, **Configure**, **Suspend**. Releases fail until the installation is unsuspended and a new key is set as described above.

**When releases fail at "Run semantic-release":** the job log shows a line starting with `github-app-token:`:

- `GITHUB_APP_ID is not set` or `GITHUB_APP_PRIVATE_KEY is not set`: a CircleCI variable is missing.
- `GITHUB_APP_PRIVATE_KEY is not a valid private key`: the variable is not a base64-encoded `.pem` file, for example because it was pasted with line breaks.
- `... returned 401`: the key is not this App's, or was deleted. Regenerate it as described above.
- `GET /repos/AEGEE/MyAEGEE/installation returned 404`: the App is not installed on MyAEGEE, or the installation is suspended.
- `POST /app/installations/.../access_tokens returned 422`: the App is missing one of the permissions listed above.

### Version Bumping

- `feat(module):` → Minor version bump (1.2.0 → 1.3.0)
- `fix(module):` → Patch version bump (1.2.0 → 1.2.1)
- `feat(module)!:` or `BREAKING CHANGE:` → Major version bump (1.2.0 → 2.0.0)
- `chore(ci):`, `chore(docker):`, etc. → Bumps ALL modules

### Cross-Module Changes

When working on multiple modules simultaneously:

```bash
# Option 1: Separate commits (preferred)
git commit -m "feat(frontend): add user dashboard"
git commit -m "feat(core): add dashboard API endpoint"

# Both modules will release independently
```

### Infrastructure Changes

Commits affecting infrastructure trigger releases for ALL modules:

- `fix(ci):` - CircleCI changes
- `chore(docker):` - Docker compose changes
- `chore(deps):` - Root dependency updates

This ensures all modules stay synchronized with infrastructure updates.

## Development Workflow

### Setup

1. Install dependencies (from root):
   ```bash
   npm install
   ```

2. Work in module directory:
   ```bash
   cd core
   # Make changes
   ```

3. Test locally before pushing:
   ```bash
   npm test
   npm run lint
   ```

### Creating a Pull Request

1. Create feature branch:
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. Make changes with proper scoped commits

3. Push branch:
   ```bash
   git push origin feat/your-feature-name
   ```

4. Create PR targeting `stable` branch

5. Wait for CI checks to pass

6. Request review from maintainers

## Module Versions

| Module | Current Version |
|--------|----------------|
| core | 1.40.1 |
| events | 1.8.0 |
| frontend | 1.45.5 |
| discounts | 1.2.6 |
| knowledge | 1.0.6 |
| network | 1.3.2 |
| statutory | 1.14.8 |
| summeruniversity | 1.6.6 |
| mailer | 0.19.0 |

## Questions?

If you have questions about contributing, please:
1. Check existing documentation
2. Open an issue for discussion
3. Ask in the AEGEE technical Slack channel
