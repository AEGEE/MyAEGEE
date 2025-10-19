# MyAEGEE Dev Container Notes

This dev container automates setup and startup of the MyAEGEE services. A few key differences from the legacy Vagrant flow:

- Environment files

  - Legacy tooling expects a `.env` file.
  - The dev container generates `.env.devcontainer` with sane defaults for localhost URLs and development settings.
  - The Makefile and helper scripts have been updated to fall back to `.env.devcontainer` when `.env` is not present.

- Running `make start`

  - Historically, `make start`/`./helper.sh --start` were intended for the Vagrant guest and would exit if run on the host.
  - In Dev Containers / GitHub Codespaces, this guard is automatically bypassed so you can run `make start` inside the container.
  - You can also explicitly bypass the guard anywhere by setting `MYAEGEE_ALLOW_NON_VAGRANT=true` before invoking `make`.

- Minimal vs Full services

  - Use `ENABLED_SERVICES` in `.env` or `.env.devcontainer` (colon-separated) to control which services start.
  - Example minimal mode (core + frontend): `ENABLED_SERVICES=core:frontend`.

- Handy aliases (loaded into your shell in this container)

  - `mstart`/`mstop`/`mrestart`/`mlogs`/`mstatus` map to common `make` targets
  - `hstart`/`hstop`/`hlogs` map to the underlying helper script

- Troubleshooting
  - If `make start` fails with missing `.env`, ensure this repository root contains `.env.devcontainer` (created automatically) or copy `.env.example` to `.env`.
  - To inspect current compose configuration: `./helper.sh --debug` (writes `would-be-config.yml`).
  - To list service status: `make list` or `docker ps`.
