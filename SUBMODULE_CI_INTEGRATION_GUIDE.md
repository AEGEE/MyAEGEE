# Submodule CI Integration Guide for AI Agents

## Overview
This guide provides instructions for integrating a submodule's CircleCI configuration into the root MyAEGEE repository's CI after merging the submodule into the monorepo.

## Prerequisites
- Submodule has been merged into the parent repository (no longer a git submodule)
- Submodule directory exists at root level (e.g., `core/`, `events/`, `network/`)
- Submodule has a `.circleci/config.yml` file with jobs and workflows

## Integration Steps

### 1. Analyze Submodule's CI Configuration

Read the submodule's CircleCI config:
```bash
cat <submodule>/.circleci/config.yml
```

Identify:
- **Jobs**: Test, build, lint, audit, docker-build-and-push, etc.
- **Workflows**: How jobs are organized and triggered
- **Filters**: Branch filters (e.g., `only: stable`, `ignore: stable`)
- **Triggers**: Scheduled jobs (cron)

### 2. Copy Jobs to Root CI Config

For each job in `<submodule>/.circleci/config.yml`:

1. **Prefix job name** with submodule name: `test` → `<submodule>-test`

2. **Add working directory** to steps that need it:
   - For `node/install-packages`: add `app-dir: ~/project/<submodule>`
   - For `run` commands: add `working_directory: ~/project/<submodule>`

3. **Update file paths** in docker build commands:
   - Change relative paths to include submodule prefix
   - Example: `docker/docker-compose.yml` → `<submodule>/docker/docker-compose.yml`

4. **Update Slack notifications** (if present):
   - Change message text to mention the module name
   - Example: `"$CIRCLE_PROJECT_REPONAME"` → `"core module in $CIRCLE_PROJECT_REPONAME"`

### 3. Add Jobs to Root `.circleci/config.yml`

Insert jobs under the `jobs:` section in alphabetical order by module name.

**Template for a typical test job:**
```yaml
<submodule>-test:
  docker:
    - image: cimg/node:22.20.0
    - image: cimg/postgres:17.6
      environment:
        POSTGRES_PASSWORD: config.test.postgres.password
  parallelism: 4
  resource_class: large
  steps:
    - checkout
    - node/install-packages:
        pkg-manager: npm
        app-dir: ~/project/<submodule>
    - run: mkdir -p ~/reports/jest
    - run:
        name: Run <submodule> tests
        working_directory: ~/project/<submodule>
        command: |
          TEST=$(circleci tests glob test/**/*.js | circleci tests split --split-by=timings)
          JEST_JUNIT_OUTPUT_DIR=$HOME/reports/jest npm run test:ci $TEST -- --reporters=default --reporters=jest-junit
    - codecov/upload
    - store_test_results:
        path: ~/reports
    - store_artifacts:
        path: ~/reports
```

**Key changes from submodule's original config:**
- Job name: `test` → `<submodule>-test`
- Added `app-dir: ~/project/<submodule>` to `node/install-packages`
- Added `working_directory: ~/project/<submodule>` to run steps
- Updated run step name: `Run tests` → `Run <submodule> tests`

### 4. Create Workflows

Add workflows under the `workflows:` section, following this naming pattern:

```yaml
<submodule>-linters:
  jobs:
    - <submodule>-eslint

<submodule>-build:
  jobs:
    - <submodule>-build:
        filters:
          branches:
            ignore: stable
    - <submodule>-db-recreate

<submodule>-test:
  jobs:
    - <submodule>-test

<submodule>-docker-build-and-push:
  jobs:
    - <submodule>-docker-build-and-push:
        filters:
          branches:
            only: stable

<submodule>-audit:
  triggers:
    - schedule:
        cron: "0 0 * * 5"
        filters:
          branches:
            only: stable
  jobs:
    - <submodule>-audit
```

### 5. Common Job Types and Patterns

#### ESLint Job
```yaml
<submodule>-eslint:
  docker:
    - image: cimg/node:22.20.0
  resource_class: large
  steps:
    - checkout
    - node/install-packages:
        pkg-manager: npm
        app-dir: ~/project/<submodule>
    - run: mkdir -p ~/reports
    - run:
        name: Run <submodule> eslint
        working_directory: ~/project/<submodule>
        command: npm run lint -- --format junit --output-file ~/reports/eslint.xml
    - store_test_results:
        path: ~/reports
    - store_artifacts:
        path: ~/reports
```

#### Build Job (Docker)
```yaml
<submodule>-build:
  docker:
    - image: cimg/base:2025.12
  resource_class: large
  steps:
    - checkout
    - setup_remote_docker:
        version: default
    - run: docker-compose -f <submodule>/docker/docker-compose.yml -f <submodule>/docker/docker-compose.dev.yml build --no-cache <submodule>
```

#### Database Recreate Job
```yaml
<submodule>-db-recreate:
  docker:
    - image: cimg/node:22.20.0
    - image: cimg/postgres:17.6
      environment:
        POSTGRES_PASSWORD: config.test.postgres.password
  resource_class: large
  steps:
    - checkout
    - node/install-packages:
        pkg-manager: npm
        app-dir: ~/project/<submodule>
    - run:
        name: Run <submodule> db:recreate
        working_directory: ~/project/<submodule>
        command: NODE_ENV=test npm run db:recreate
```

#### Audit Job (with Slack notification)
```yaml
<submodule>-audit:
  docker:
    - image: cimg/node:22.20.0
  resource_class: large
  steps:
    - checkout
    - run:
        name: Run <submodule> audit
        working_directory: ~/project/<submodule>
        command: npm audit --production
    - slack/notify:
        event: fail
        custom: |
          {
            "blocks": [
              {
                "type": "section",
                "text": {
                  "type": "mrkdwn",
                  "text": ":x: The audit check for <submodule> module in `$CIRCLE_PROJECT_REPONAME` has failed."
                }
              },
              {
                "type": "section",
                "fields": [
                  {
                    "type": "mrkdwn",
                    "text": "*Project*\n$CIRCLE_PROJECT_REPONAME"
                  },
                  {
                    "type": "mrkdwn",
                    "text": "*Job Number*\n$CIRCLE_BUILD_NUM"
                  }
                ]
              },
              {
                "type": "actions",
                "elements": [
                  {
                    "type": "button",
                    "text": {
                      "type": "plain_text",
                      "text": "Visit Job"
                    },
                    "url": "${CIRCLE_BUILD_URL}"
                  }
                ]
              }
            ]
          }
```

#### Docker Build and Push Job
```yaml
<submodule>-docker-build-and-push:
  docker:
    - image: cimg/node:22.20.0
  resource_class: large
  steps:
    - checkout
    - setup_remote_docker:
        version: default
    - node/install-packages:
        pkg-manager: npm
        app-dir: ~/project/<submodule>
    - run:
        name: Run semantic-release for <submodule>
        working_directory: ~/project/<submodule>
        command: npx semantic-release
    - run:
        name: Build and push <submodule> Docker image
        working_directory: ~/project/<submodule>
        command: |
          export PACKAGE_VERSION=$(node -p "require('./package.json').version")
          docker build --tag aegee/<submodule>:$PACKAGE_VERSION --tag aegee/<submodule>:latest -f docker/<submodule>/Dockerfile .
          docker login --username $DOCKER_LOGIN --password $DOCKER_PASSWORD
          docker push aegee/<submodule>:$PACKAGE_VERSION
          docker push aegee/<submodule>:latest
    - slack/notify:
        event: pass
        custom: |
          {
            "blocks": [
              {
                "type": "section",
                "text": {
                  "type": "mrkdwn",
                  "text": ":white_check_mark: The Docker image for <submodule> module with tags `$PACKAGE_VERSION` and `latest` has been pushed to Dockerhub."
                }
              },
              ...
            ]
          }
    - slack/notify:
        event: fail
        custom: |
          {
            "blocks": [
              {
                "type": "section",
                "text": {
                  "type": "mrkdwn",
                  "text": ":octagonal_sign: The Docker image for <submodule> module build and push has failed."
                }
              },
              ...
            ]
          }
```

### 6. Verification Steps

After adding the CI configuration:

1. **Validate YAML syntax:**
   ```bash
   yamllint .circleci/config.yml
   ```

2. **Check for consistency:**
   - All job names prefixed with `<submodule>-`
   - All `working_directory` points to `~/project/<submodule>`
   - All `app-dir` points to `~/project/<submodule>`
   - Slack messages mention the module name

3. **Review workflows:**
   - Appropriate branch filters are set
   - Scheduled jobs have correct cron expressions
   - Jobs are in the correct workflow

4. **Commit changes:**
   ```bash
   git add .circleci/config.yml
   git commit -m "feat(ci): integrate <submodule> CI into root CircleCI config"
   ```

## Example: Module Integration

### Core Module
See commits:
- `6992bdc` - "fix(core): fix hadolint warning and integrate CircleCI jobs"
- `a56542f` - "fix(ci): use docker-compose for core build instead of direct docker build"

The core module integration added these jobs:
- `core-test`
- `core-db-recreate`
- `core-build`
- `core-eslint`
- `core-audit`
- `core-docker-build-and-push`

And these workflows:
- `core-linters`
- `core-build`
- `core-test`
- `core-docker-build-and-push`
- `core-audit`

### Discounts Module
For discounts module integration, follow the same pattern:
- Replace `<submodule>` with `discounts` in all examples above
- Update job names: `test` → `discounts-test`, `build` → `discounts-build`, etc.
- Update working directories to `~/project/discounts`
- Update docker-compose paths to `discounts/docker/docker-compose.yml`

## Common Gotchas

1. **Forgetting `working_directory`**: npm/docker commands will fail if not in the correct directory
2. **Forgetting `app-dir`**: Dependencies won't install in the right location
3. **Not updating Slack messages**: Makes it unclear which module failed
4. **Wrong docker-compose paths**: Must use absolute paths from repo root
5. **Branch filters**: Ensure build jobs ignore `stable` and deploy jobs only run on `stable`
6. **Husky prepare script**: Frontend and other modules with husky will fail in CI because `.git` is at repo root, not in the submodule directory. Use `npm ci --ignore-scripts` instead of `node/install-packages` orb
7. **Hadolint DL3025 violations**: Many Dockerfiles use shell form for CMD. Convert to JSON notation: `CMD ["sh", "-c", "command"]`

## Submodules Integration Status

Based on `.gitmodules`, these submodules have been integrated:
- ✅ core (completed - #1449)
- ✅ discounts (completed - #1463)
- ✅ events (completed - #1464)
- ✅ frontend (completed - #1466) - **Note**: Uses `npm ci --ignore-scripts` to skip husky
- ✅ knowledge (completed - #1472)

Remaining submodules to integrate:
- ⏳ statutory
- ⏳ summeruniversity
- ⏳ mailer
- ⏳ gsuite-wrapper
- ⏳ network

Always check if a submodule has `.circleci/config.yml` before integration.

## Special Cases

### Frontend Module (Husky Issue)
The frontend module has a husky `prepare` script that fails in CI because it looks for `.git` in the wrong location. 

**Solution**: Use `npm ci --ignore-scripts` instead of the `node/install-packages` orb:

```yaml
- run:
    name: Install frontend dependencies (skip husky)
    working_directory: ~/project/frontend
    command: npm ci --ignore-scripts
```

This applies to any module with lifecycle scripts that depend on the `.git` directory being in the submodule folder.

### Hadolint Violations
Most backend modules have a Dockerfile with shell-form CMD that violates DL3025.

**Before:**
```dockerfile
CMD sh /usr/app/scripts/bootstrap.sh && nodemon -e "js,json" lib/run.js
```

**After:**
```dockerfile
CMD ["sh", "-c", "sh /usr/app/scripts/bootstrap.sh && nodemon -e js,json lib/run.js"]
```

Fix these before or immediately after CI integration.
