# Dispatcher

Consumes messages from a RabbitMQ queue and sends transactional emails via SMTP, using Jinja2 templates.

## How to run it

Everything runs via Docker. No local Python environment is required.

```bash
# Start the full development stack (dispatcher + RabbitMQ + Mailpit)
make build-dev

# Inject test messages into the queue
make test

# Inspect sent emails
open http://mail.appserver.test   # Mailpit web UI

# Inspect RabbitMQ queues and exchanges
open http://rabbit.appserver.test  # RabbitMQ management UI (guest / guest)

# Stop the stack
make down
```

> **Local development without Docker** — only needed if you want to run/debug Python directly.
> Use [Poetry](https://python-poetry.org/): `cd dispatcher && poetry install && poetry shell`.
> You still need a running RabbitMQ and Mailpit reachable from your machine.

## Environment variables

| Variable | Default (dev) | Description |
|---|---|---|
| `ENV` | `development` | Set to `production` to enable SMTP auth and TLS |
| `RABBITMQ_HOST` | `rabbit` | RabbitMQ hostname |
| `RABBITMQ_USER` | `guest` | RabbitMQ username |
| `RABBITMQ_PASS` | `guest` | RabbitMQ password |
| `EMAIL_HOST` | `mailpit` | SMTP server hostname (production only) |
| `EMAIL_PORT` | `1025` | SMTP port (production only) |
| `EMAIL_ADDRESS` | — | SMTP login user (production only) |
| `EMAIL_PASSWORD` | — | SMTP login password (production only) |
| `APPRISE_URL` | `http://apprise:8000` | Base URL of the Apprise-API notification service |
| `APPRISE_TAG` | `myaegee` | Notification tag/channel used by Apprise |
| `NOTIFY_COOLDOWN_SECONDS` | `300` | Minimum seconds between identical Apprise notifications |

## Architecture

No service publishes to the dispatcher yet: the services send their mails to the Elixir
mailer (`mailer/`) over HTTP. The dispatcher is meant to replace it, and takes the same
message as the mailer's `POST /` body.

```
producers (none yet)
        │  exchange eml, routing key mail
        ▼
  ┌─────────────┐  template or snippet missing,   ┌──────────────────────────┐
  │ email queue │  SMTP unavailable               │ parking queues           │
  │  (durable)  │ ──────────────────────────────► │ wait_5min … wait_100h    │
  └──────┬──────┘   new message, x-retry-index    │ (x-message-ttl, DLX eml) │
         │                                        └────────────┬─────────────┘
         │ send_email                                          │ TTL expires:
         ▼                                                     │ back to email
   one mail per recipient                                      │
         │ rejected by the SMTP server / unexpected error     │
         │ (nack without requeue)                              │
         ▼                                                     │
  ┌─────────────────────┐  process_dead_letter_messages        │
  │ error_queue         │ ─────────────────────────────────────┘
  │ (dead_letter_exch.) │  into the last parking queue, with an alert
  └─────────────────────┘
```

### What happens to a message

| Case | What the dispatcher does |
|---|---|
| Valid message | Renders the template and sends one mail per address in `to`, then acks |
| Body is not a JSON object, a required field is missing, `template` is not a text, `to` is empty or holds an empty address, `parameters` don't match the recipients | Acks (drops) it and sends an operator alert: retrying can't fix the payload |
| A template parameter is missing (`StrictUndefined`) | Drops it with an alert |
| Template or one of its snippets not found | Parks it for a retry (the template may be deployed meanwhile) |
| SMTP not connected and reconnecting fails | Parks it for a retry (`smtp_unavailable`) |
| SMTP connection lost while sending | Reconnects and puts the message back in the queue (nack with requeue) |
| SMTP server rejects it, or any other error while sending | Nacks it without requeue, so it goes to `error_queue` |

### Retry logic

A message that is parked is not NACKed. Instead a *new* message carrying the same body is
published to the next parking queue (default exchange, routing key = queue name) with the
header `x-retry-index`. Each parking queue has an `x-message-ttl` and dead-letters expired
messages back to exchange `eml` with routing key `mail`, so the message re-enters `email`.
No broker plugin is needed.

| Attempt | Queue | Delay |
|---------|-------|-------|
| 1 | `wait_5min` | 5 min |
| 2 | `wait_50min` | 50 min |
| 3 | `wait_5h` | 5 h |
| 4 | `wait_50h` | 50 h |
| 5 (last) | `wait_100h` | 100 h; the alert names the person on call |

When the message comes back after the last attempt, it is dropped and an alert is sent.
`process_dead_letter_messages` pushes a message from `error_queue` into the last parking
queue, so an operator has time to look at it before it is dropped.

### Message schema

The message is the body the services send to the mailer:

| Field | Required | Description |
|---|---|---|
| `to` | yes | Recipient address, or a list: every address gets a mail of its own |
| `subject` | yes | Subject line |
| `template` | yes | Template name, with or without `.html` (`confirm_email.html` or `confirm_email`); the file is `templates/<name>.jinja2` |
| `parameters` | yes | Object with the template's parameters, or a list with one object per address in `to` (each recipient gets the text rendered from their own object) |
| `from` | no | Sender address; defaults to `EMAIL_ADDRESS` |
| `reply_to` | no | Reply-To address |
| `cc`, `bcc` | no | Address or list; set on every recipient's mail |

The parameters each template needs, with examples, are in the mail contract,
`mailer/contract/mail-templates.json`. The dispatcher's tests render every template with
those examples and check that a template reads only declared parameters, and optional ones
through `default`.

### Notification rate limiting

Apprise alerts are throttled per unique error title to prevent alert storms. If the same
error occurs on many queued messages at once (e.g. a template is missing and there are
500 messages waiting), only one alert fires per `NOTIFY_COOLDOWN_SECONDS` window (default:
300 s). Subsequent occurrences of the same error within the window are silently dropped
at the `notify()` level and logged at DEBUG.

The throttle state is in-process only — it resets on restart. This is intentional: after
a restart one alert will fire before throttling kicks in, which is the desired behaviour
(you always want to know about the first occurrence after a redeploy).

### Templates

Templates live in `templates/` as `.jinja2` files, one for each template of the mailer
(`mailer/lib/omsmailer_web/templates/page/`). Because the template is loaded from disk at
message-processing time, **adding or editing a template takes effect immediately** without
restarting the container. To add or change a mail, see `mailer/contract/README.md`.

`body` (`membership_expired`), `body_name` (most templates) and `email_body` (`custom`, raw
HTML) are different parameters. `membership_expired` has no sender at the moment; it is
kept in both renderers on purpose.

## Queues reference

| Queue | Exchange | Purpose |
|---|---|---|
| `email` | `eml` (direct, routing key `mail`) | Normal delivery queue |
| `error_queue` | `dead_letter_exchange` | Messages nacked by the dispatcher (should stay empty) |
| `wait_5min` … `wait_100h` | default exchange | Parking queues between retry attempts |

Future queues (not yet implemented):
- `telegram`
- `slack` (if EBs opt in)

## Tests

`poetry install --with dev && poetry run pytest` runs the tests with line and branch
coverage and fails below the threshold in `pyproject.toml`; `ruff check .` lints.

## TODO / backlog

- [x] Traefik labels so RabbitMQ and Mailpit are on subdomains instead of `host:port`
- [x] Mark queues and messages as durable so RabbitMQ survives restarts
- [x] Exponential-backoff retry with wait exchange (DLQ-based, up to 5 attempts)
- [x] Migrate retry mechanism from `x-delayed-message` plugin to native DLX+TTL (required before RabbitMQ 4.x)
- [~] RabbitMQ connection retry loop at startup (race condition with Docker Compose ordering) [mitigated by the docker health conditions]
- [x] Add `pika.ConnectionParameters(heartbeat=600)` to prevent silent disconnects
- [x] Add `HEALTHCHECK` to Dockerfile
- [ ] Add telegram queue
- [ ] Investigate mass-mailer queue (BCC batching) — unclear if feasible given personalised content
