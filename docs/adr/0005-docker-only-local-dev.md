# ADR-0005: Docker-only local development

- Status: **Proposed**
- Date: 2026-11-18
- Proposed by: me (for team review)

## Context

Local setup historically asked people for VirtualBox, Vagrant, guest hostname checks, `start.sh`, `Makefile`, and `helper.sh`. That is a lot of ceremony for a volunteer who wants to fix one bug on a Windows laptop after work.

The runtime is already Docker. The VM layer mostly exists to paper over “works on my Linux guest.” I want **one supported local path**: Docker Compose on the machine you already use.

## Options

| Option | Upside | Downside |
| --- | --- | --- |
| Keep Vagrant as the blessed path | Matches old docs | Heavy; Windows pain; dual maintenance |
| Document WSL-only scripts | Closer to Linux guest | Still not “just Docker”; another OS to learn |
| Devcontainers in VS Code/Cursor only | Nice for some editors | Excludes people not using that editor |
| **Docker Compose on the host (Docker Desktop / Engine)** | Same on Win/macOS/Linux | Must fix Traefik/modern Engine quirks |
| “Run Node processes only, mock the rest” | Fastest for pure API work | Diverges from real wiring; easy to miss integration bugs |

## What I propose

**Docker Compose is the supported local path.** Root compose entrypoint. No Vagrant/Make/helper required for day-to-day work. Retire guest-oriented glue from the default contributor story.

## Benefits I see

- Fewer tools to install before the first green page.
- Same commands across operating systems volunteers actually use.
- Compose files stay the source of truth for service wiring.
- Onboarding docs get shorter and more honest.

## Consequences / tradeoffs

- README must stop centering `vagrant up`.
- Traefik v1’s Docker provider breaks on Docker Engine 29+; we need file-based local routes or a Traefik upgrade.
- Unsupported legacy files should not keep receiving “official” support effort.

## Related sources

- Root `compose.yaml`
- ADR-0003, ADR-0006

## Open questions for the team

- How long do we keep Vagrant files in the tree as unsupported archaeology?
- Traefik v3 migration timing vs file-provider workaround?
