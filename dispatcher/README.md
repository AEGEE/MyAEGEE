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

```
producers (core, events, statutory, …)
        │
        ▼
  ┌─────────────┐     template missing    ┌─────────────────┐
  │ email queue │ ──────────────────────► │  wait_exchange  │
  │  (durable)  │                         │ (x-delayed-msg) │
  └──────┬──────┘                         └────────┬────────┘
         │                                         │ after delay
         │ normal path                             ▼
         ▼                               ┌──────────────────┐
    dispatcher                          │  requeue_queue   │
    (send_email)                         │   → re-enqueues  │
         │                               │     on email     │
         │ unexpected NACK               └──────────────────┘
         ▼
  ┌─────────────────────┐
  │  dead_letter_queue  │  → process_dead_letter_messages
  │  (error_queue)      │    (last-resort: pushes to wait_exchange with max delay)
  └─────────────────────┘
```

### Retry logic

A message that cannot be processed (e.g. template not found) is not NACKed. Instead
a *new* message carrying the same body is published to `wait_exchange` with an `x-delay`
header. After the delay the broker routes it to `requeue_queue`, which re-enqueues it
on `email`. The delay grows exponentially across up to 5 attempts:

| Attempt | Delay |
|---------|-------|
| 1 | 5 min |
| 2 | 50 min |
| 3 | 5 h |
| 4 | 50 h |
| 5 (last) | 100 h |

After the last attempt the message is dropped and an alert is sent via Apprise.

Errors where retry is pointless (e.g. `parameter_undefined`) are dropped immediately
without entering the wait loop.

### Message schema validation

Before any processing, every message dequeued from `email` is validated against a fixed
set of required fields:

| Field | Type | Description |
|---|---|---|
| `from` | string | Sender address |
| `to` | string or list | Recipient address(es) |
| `reply_to` | string | Reply-To address |
| `subject` | string | Email subject line |
| `template` | string | Template name (without `.jinja2` extension) |
| `parameters` | object | Variables passed to the Jinja2 template |

If any field is missing the message is **dropped immediately** (acked, not NACKed) and an
Apprise alert is fired. Retrying would be pointless because the payload cannot be fixed
by waiting — the bug is in the producing service. The dropped message and all missing field
names are written to the error log for investigation.

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

Templates live in `templates/` as `.jinja2` files. Because the template is loaded from
disk at message-processing time, **adding or editing a template takes effect immediately**
without restarting the container — hot-reload is built-in.

#### ⚠ Known naming debt: `body` vs `body_name` vs `email_body`

Three template parameters share confusingly similar names and mean completely different things:

| Parameter | Meaning | Used in |
|---|---|---|
| `body` | A European body (local/antenna), e.g. `AEGEE-Padova` | `membership_expired.jinja2` |
| `body_name` | Short name of a body or commission, e.g. `ITC`, `HRC` | most other templates |
| `email_body` | Raw HTML content of a fully custom email | `custom.jinja2` only |

The ideal end state is to drop the standalone `body` key entirely and use `body_name`
everywhere for the "European body" concept. This is blocked by the **CORE microservice**,
which currently publishes `body` (not `body_name`) in the `membership_expired` payload.
Until a coordinated change is made in CORE, `membership_expired.jinja2` must keep using
`{{ body }}` and the field must remain in the test payload in `helpers/send.py`.

## Queues reference

| Queue | Exchange | Purpose |
|---|---|---|
| `email` | `eml` (direct) | Normal delivery queue |
| `error_queue` | `dead_letter_exchange` | Catches unexpected NACKs (should stay empty) |
| `requeue_queue` | `wait_exchange` (x-delayed-message) | Holds messages between retry attempts |

Future queues (not yet implemented):
- `telegram`
- `slack` (if EBs opt in)

## Migrating away from `rabbitmq-delayed-message-exchange`

> **Context** — The `x-delayed-message` exchange type is provided by the community plugin
> [`rabbitmq-delayed-message-exchange`](https://github.com/rabbitmq/rabbitmq-delayed-message-exchange).
> The plugin was **archived on 2026-04-16** and will not be ported to RabbitMQ 4.x
> (Mnesia — the storage layer the plugin relies on — is being removed in 4.3+).
> The current setup works fine on RabbitMQ 3.13 but needs to be replaced before upgrading
> to 4.x.

### Replacement: per-tier TTL queues + DLX

Native RabbitMQ supports the same pattern using **one "parking" queue per delay tier**.
Each parking queue is configured with:
- `x-message-ttl` — the delay in milliseconds
- `x-dead-letter-exchange` — the main exchange (`eml`)
- `x-dead-letter-routing-key` — `mail` (so the message re-enters the normal delivery queue)

When a message expires in a parking queue, the broker automatically dead-letters it back
into `email` — no plugin needed.

**Queue declarations to add in `main()`:**

```python
RETRY_QUEUES = [
    ("wait_5min",  5        * 60_000),   # 5 min
    ("wait_50min", 50       * 60_000),   # 50 min
    ("wait_5h",    5  * 60  * 60_000),   # 5 h
    ("wait_50h",   50 * 60  * 60_000),   # 50 h
    ("wait_100h",  100 * 60 * 60_000),   # 100 h
]

for queue_name, ttl_ms in RETRY_QUEUES:
    channel.queue_declare(
        queue=queue_name,
        durable=True,
        arguments={
            "x-message-ttl": ttl_ms,
            "x-dead-letter-exchange": "eml",
            "x-dead-letter-routing-key": "mail",
        },
    )
```

**Updated `requeue_wait`** — instead of publishing to `wait_exchange` with `x-delay`,
publish directly to the correct parking queue (exchange `""` = default exchange,
routing key = queue name):

```python
RETRY_QUEUE_NAMES = [name for name, _ in RETRY_QUEUES]

# current delay tier is tracked via x-retry-index header instead of x-delay
current_index = (properties.headers or {}).get("x-retry-index", -1)
next_index = int(current_index) + 1

channel.basic_publish(
    exchange="",
    routing_key=RETRY_QUEUE_NAMES[next_index],
    body=body,
    properties=pika.BasicProperties(
        headers={"reason": reason, "x-retry-index": next_index},
        delivery_mode=pika.spec.PERSISTENT_DELIVERY_MODE,
    ),
)
```

**What to remove** once the migration is done:
- `wait_exchange` declaration (type `x-delayed-message`)
- `requeue_queue` declaration and its consumer (`process_requeue`)
- The `aegee/rabbit` custom image — use the official `rabbitmq:3.13-management` directly
- `Dockerfile.rabbit`

The `error_queue` / `dead_letter_exchange` remain unchanged.

## TODO / backlog

- [x] Run core with email as queue insertion instead of API request to mailer
- [x] Traefik labels so RabbitMQ and Mailpit are on subdomains instead of `host:port`
- [x] Mark queues and messages as durable so RabbitMQ survives restarts
- [x] Exponential-backoff retry with wait exchange (DLQ-based, up to 5 attempts)
- [x] Migrate retry mechanism from `x-delayed-message` plugin to native DLX+TTL (required before RabbitMQ 4.x)
- [~] RabbitMQ connection retry loop at startup (race condition with Docker Compose ordering) [mitigated by the docker health conditions]
- [x] Add `pika.ConnectionParameters(heartbeat=600)` to prevent silent disconnects
- [x] Add `HEALTHCHECK` to Dockerfile
- [ ] Add telegram queue
- [ ] Investigate mass-mailer queue (BCC batching) — unclear if feasible given personalised content
