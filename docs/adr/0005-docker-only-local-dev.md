# ADR-0005: Docker-only local development

- Status: **Proposed**
- Date: 2026-11-18
- Deciders: Rewrite / platform initiative (pending team acceptance)

## Context

Local setup historically required VirtualBox, Vagrant, guest hostname checks, `start.sh`, `Makefile`, and `helper.sh` stitching many compose files. That fails often on Windows and slows onboarding. The stack is already Docker-based; the VM layer adds little for web development.

## Options

| Option | Upside | Downside |
| --- | --- | --- |
| Keep Vagrant as the supported path | Matches old docs | Heavy; Windows friction; dual maintenance |
| WSL-only scripts | Slightly closer to Linux guest | Still not “just Docker”; hostname hacks |
| **Docker Compose on the host** | One path everywhere Docker Desktop/Engine works | Must fix Traefik/API quirks on modern Engine |

## Decision

**Docker Compose is the supported local path.** Root compose entrypoint, no Vagrant/Make/helper required for day-to-day work. Retire Vagrantfiles and guest-oriented glue from the default contributor story.

## Benefits

- Same commands on Windows, macOS, and Linux.
- Faster clone-to-running-app for volunteers.
- Compose files stay the source of truth for service wiring.
- Aligns local with how images already run in CI/prod-ish environments.

## Consequences

- Docs and README must stop centering `vagrant up`.
- Traefik v1 Docker provider breaks on Docker Engine 29+ (API age); local file-based routes or a Traefik upgrade are required (see compose `TRAEFIK_CONFIG`).
- Ops scripts that assumed the guest hostname move under `infra/scripts` or are deleted.

## Related sources

- Root `compose.yaml` (docker-only entry)
- README installation sections (to be updated)
- ADR-0003 (deployment), ADR-0006 (layout)

## Open questions

- How long to keep Vagrant files in-repo as unsupported legacy?
- Traefik v3 migration timing vs file-provider workaround
