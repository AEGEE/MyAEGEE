"""
Continuously polls the email queue and renders + sends a template on every
acknowledged message. The process blocks waiting for RabbitMQ to push messages
(push-based, not polling).
"""

import json
import logging
import os
import smtplib
import sys
from email.message import EmailMessage

import pika
from jinja2 import Environment, FileSystemLoader, StrictUndefined, exceptions, select_autoescape
from notify import operator_alert

ONCALL_HANDLER = "@grasshopper"

# All fields that must be present in every message published to the email queue.
# A missing field means the producer sent a malformed payload; retrying will never fix it,
# so the message is dropped immediately with an ack and an alert.
# `from` and `reply_to` are intentionally absent: `from` falls back to EMAIL_ADDRESS,
# `reply_to` is simply omitted when not provided. `cc` and `bcc` are always optional.
REQUIRED_MESSAGE_FIELDS: frozenset[str] = frozenset({
    "to", "subject", "template", "parameters",
})


def validate_message(msg: dict) -> list[str]:
    """Return a sorted list of missing required field names, empty if the message is valid."""
    return sorted(REQUIRED_MESSAGE_FIELDS - msg.keys())


# Exponential-backoff delay tiers used by the native DLX+TTL retry mechanism.
# IMPORTANT: this list is the single source of truth — do not duplicate it.
# Each tuple is (queue_name, ttl_ms). The retry tier is tracked via the x-retry-index
# message header. When a message expires in a parking queue the broker automatically
# dead-letters it back to the eml exchange (routing key: mail) — no plugin required.
RETRY_QUEUES = [
    ("wait_5min",  5        * 60_000),   # attempt 1:  5 min
    ("wait_50min", 50       * 60_000),   # attempt 2: 50 min
    ("wait_5h",    5  * 60  * 60_000),   # attempt 3:  5 h
    ("wait_50h",   50 * 60  * 60_000),   # attempt 4: 50 h
    ("wait_100h",  100 * 60 * 60_000),   # attempt 5: 100 h  ← last attempt, operator alerted
]
RETRY_QUEUE_NAMES = [name for name, _ in RETRY_QUEUES]

# Resolved once at import time so the path is independent of the working directory.
# Can be overridden via the TEMPLATES_PATH env var for non-Docker environments.
_TEMPLATES_DIR: str = os.environ.get(
    "TEMPLATES_PATH",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "templates"),
)

# Initialised to None; set by connect_to_smtp(). Kept as a module-level variable so
# all callbacks share a single SMTP connection without passing it through pika callbacks.
smtpObj: smtplib.SMTP | None = None

# Fallback sender address used when a message does not include an explicit `from` field.
# Set once at startup from the EMAIL_ADDRESS env var (same value used for SMTP login).
EMAIL_ADDRESS: str | None = None


def create_template_environment(templates_dir: str = _TEMPLATES_DIR) -> Environment:
    def _jinja2_finalize(value):
        if value is None:
            return ''
        if isinstance(value, bool):
            return str(value).lower()
        return value

    return Environment(
        loader=FileSystemLoader(templates_dir),
        autoescape=select_autoescape(enabled_extensions=("jinja2",)),
        finalize=_jinja2_finalize,
        undefined=StrictUndefined,
    )


def template_file_name(template: str) -> str:
    """The template file for a template name; the services send names like confirm_email.html,
    the mailer accepts them with or without the suffix."""
    return f"{template.removesuffix('.html')}.jinja2"


def connect_to_smtp():
    global smtpObj

    EMAIL_HOST = 'mailpit'
    EMAIL_PORT = 1025
    EMAIL_ADDRESS = None
    EMAIL_PASSWORD = None

    if env == 'production':
        EMAIL_HOST = os.environ.get("EMAIL_HOST")
        EMAIL_PORT = os.environ.get("EMAIL_PORT")
        EMAIL_ADDRESS = os.environ.get("EMAIL_ADDRESS")
        EMAIL_PASSWORD = os.environ.get("EMAIL_PASSWORD")

    try:
        smtpObj = smtplib.SMTP(EMAIL_HOST, EMAIL_PORT)

        if env == 'production':
            # starttls() upgrades the plain connection to TLS before sending credentials.
            # Tested with ethereal.email; behaviour may differ for other providers.
            smtpObj.starttls()
            smtpObj.login(EMAIL_ADDRESS, EMAIL_PASSWORD)
        logging.info("   -> Connected")
    except smtplib.SMTPConnectError:
        logging.error("Could not connect to the SMTP server.")
    except smtplib.SMTPAuthenticationError:
        logging.error("Failed to authenticate with given credentials.")
    except Exception as e:
        logging.error(f"Could not connect to SMTP server for generic reason: {e}")


def requeue_wait(ch, method, properties, body, reason):
    current_index = (properties.headers or {}).get("x-retry-index", -1)
    next_index = int(current_index) + 1

    if next_index >= len(RETRY_QUEUE_NAMES):
        logging.warning('Max retry time hit, dropping message')
        operator_alert(f"Time over, a message was dropped ({reason})", submessage=":poop:")
        ch.basic_ack(delivery_tag=method.delivery_tag)
        return

    _, wait_ms = RETRY_QUEUES[next_index]
    retry_message = f'Retry attempt {next_index + 1}/{len(RETRY_QUEUE_NAMES)} will happen in {int(wait_ms/1000)} sec'
    logging.info(retry_message)
    last_chance = ''
    if next_index + 1 == len(RETRY_QUEUE_NAMES):
        last_chance = f'-- LAST ATTEMPT TO FIX: within {int(wait_ms/1000)} sec {ONCALL_HANDLER}'
        logging.error(last_chance)
    operator_alert(f"A template is missing! ({reason})",
                submessage=retry_message + " " + last_chance)

    # Publish a *new* message carrying the original body rather than NACKing.
    # NACK with requeue=True would cause an immediate retry loop; NACK with requeue=False
    # would send it to the DLQ. Neither gives us the exponential backoff we want.
    # See https://stackoverflow.com/a/58500336
    # Publishing to exchange="" (the default exchange) routes directly to the named parking
    # queue. The broker will dead-letter the message back to eml/mail after x-message-ttl
    # expires — no plugin required.
    channel.basic_publish(
        exchange="",
        routing_key=RETRY_QUEUE_NAMES[next_index],
        body=body,
        properties=pika.BasicProperties(
            headers={"reason": reason, "x-retry-index": next_index},
            delivery_mode=pika.spec.PERSISTENT_DELIVERY_MODE,
        ),
    )
    ch.basic_ack(delivery_tag=method.delivery_tag)


def build_email(msg: dict, recipient: str, text: str) -> EmailMessage:
    """One mail to one recipient; cc, bcc and reply-to are set on every recipient's mail."""
    email = EmailMessage()
    email.set_content(text, subtype='html')
    email['From'] = msg.get('from') or EMAIL_ADDRESS or ''
    email['To'] = recipient
    email['Subject'] = msg['subject']
    if msg.get('reply_to'):
        email['Reply-To'] = msg['reply_to']
    if msg.get('cc'):
        cc = msg['cc']
        email['Cc'] = ', '.join(cc) if isinstance(cc, list) else cc
    if msg.get('bcc'):
        bcc = msg['bcc']
        email['Bcc'] = ', '.join(bcc) if isinstance(bcc, list) else bcc
    return email


def send_email(ch, method, properties, body):
    """
    Callback for the NORMAL MESSAGE.
    Output: send an email
        OR
    Output: publish to a parking queue (template missing or rendering error)
    """
    global smtpObj

    try:
        msg = json.loads(body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        msg = None
    if not isinstance(msg, dict):
        # Retrying will never fix it. The body is not logged: it can hold personal data.
        logging.error("Dropping a message whose body is not a JSON object")
        operator_alert("Malformed message dropped: the body is not a JSON object",
                    submessage="The producer sent a payload that is not a JSON object. Check the sending service.")
        ch.basic_ack(delivery_tag=method.delivery_tag)
        return

    missing = validate_message(msg)
    if missing:
        logging.error(f"Dropping malformed message: missing fields {missing}. Body: {body}")
        operator_alert(f"Malformed message dropped: missing fields {missing}",
                    submessage="The producer sent an incomplete payload. Check the sending service.")
        ch.basic_ack(delivery_tag=method.delivery_tag)
        return

    if not isinstance(msg['template'], str) or not msg['template']:
        logging.error("Dropping a message whose template name is not a text")
        operator_alert("Malformed message dropped: the template name is not a text",
                    submessage="The producer sent an invalid template name. Check the sending service.")
        ch.basic_ack(delivery_tag=method.delivery_tag)
        return

    # One mail per recipient, as the mailer sends them: the recipients don't see each other.
    recipients = msg['to'] if isinstance(msg['to'], list) else [msg['to']]
    if not recipients or not all(isinstance(r, str) and r for r in recipients):
        logging.error("Dropping a message without a valid recipient")
        operator_alert("Malformed message dropped: no valid recipient",
                    submessage="The producer sent an empty or invalid `to`. Check the sending service.")
        ch.basic_ack(delivery_tag=method.delivery_tag)
        return

    # `parameters` is one object for every recipient, or a list with one object per
    # recipient (a mass mail with a text per person).
    parameters = msg['parameters']
    if isinstance(parameters, list):
        valid = (isinstance(msg['to'], list) and len(parameters) == len(recipients)
                 and all(isinstance(p, dict) for p in parameters))
    else:
        valid = isinstance(parameters, dict)
    if not valid:
        logging.error("Dropping a message whose parameters don't match its recipients")
        operator_alert("Malformed message dropped: parameters don't match the recipients",
                    submessage="`parameters` must be an object, or a list with one object per address in `to`.")
        ch.basic_ack(delivery_tag=method.delivery_tag)
        return

    template_name = template_file_name(msg['template'])
    try:
        template = tpl_environment.get_template(template_name)
    except exceptions.TemplateNotFound:
        logging.error(f"Template {template_name} not found")
        # Requeuable: the template may be deployed while the message is waiting.
        requeue_wait(ch, method, properties, body, reason=f"template_not_found-{msg['template']}")
        return

    try:
        # All texts are rendered before anything is sent: one that fails drops the whole message.
        if isinstance(parameters, list):
            texts = [template.render(p, altro=msg['subject']) for p in parameters]
        else:
            texts = [template.render(parameters, altro=msg['subject'])] * len(recipients)
    except exceptions.UndefinedError as e:
        logging.error(f"Error in rendering: some parameter is undefined (error: {e}; message: {msg})")
        # NON-requeuable: the payload is malformed and retrying will never fix it.
        # Drop immediately — with native TTL+DLX there is no filter step that would
        # intercept a re-delivered copy, so requeueing would cause an infinite loop.
        operator_alert("Malformed message dropped: undefined template parameter",
                    submessage="The producer sent an incomplete payload. Check the sending service.")
        ch.basic_ack(delivery_tag=method.delivery_tag)
        return
    except exceptions.TemplateNotFound:
        logging.error(f"A sub-template in {template_name} was not found")
        # Requeuable: a missing snippet template may be deployed while waiting.
        requeue_wait(ch, method, properties, body, reason=f"subtemplate_not_found-{msg['template']}")
        return

    if smtpObj is None:
        logging.warning("SMTP not connected, attempting to reconnect before sending")
        connect_to_smtp()
    if smtpObj is None:
        logging.error("SMTP still unavailable after reconnect attempt, requeueing message")
        requeue_wait(ch, method, properties, body, reason="smtp_unavailable")
        return

    try:
        for recipient, text in zip(recipients, texts):
            smtpObj.send_message(build_email(msg, recipient, text))
        ch.basic_ack(delivery_tag=method.delivery_tag)
    except smtplib.SMTPServerDisconnected:
        # The message goes back to the queue. If reconnecting fails, smtpObj stays None and
        # the next delivery parks the message in the retry queues (smtp_unavailable).
        logging.error("Server unexpectedly disconnected. Attempting to reconnect")
        smtpObj = None
        connect_to_smtp()
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)
    except smtplib.SMTPResponseException as e:
        # Rejected by the server: dead-letter it, process_dead_letter_messages parks it
        # in the last retry queue and alerts.
        logging.error(f"SMTP error occurred: {e.smtp_code} - {e.smtp_error}")
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
    except Exception as e:
        logging.error(f"An unexpected error occurred: {e}")
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)


def process_dead_letter_messages(ch, method, properties, body):
    """
    Callback for the ERROR MESSAGE (dead-letter queue).
    This queue should normally stay empty. Its presence is a safety net: if a message
    somehow ends up here (unexpected NACK), we push it into the last parking queue so an
    operator has time to investigate before the broker re-delivers it to email.

    See https://stackoverflow.com/a/58500336 on why we republish instead of NACKing.
    """
    logging.error("DLQ handler triggered — a message ended up in error_queue unexpectedly.")
    operator_alert("For some reason there's the DLQ handler that was triggered!")

    # Set x-retry-index to the last tier so that if send_email still cannot process the
    # message after the TTL expires, requeue_wait will drop it and alert rather than retry.
    last_index = len(RETRY_QUEUE_NAMES) - 1
    channel.basic_publish(
        exchange="",
        routing_key=RETRY_QUEUE_NAMES[last_index],
        body=body,
        properties=pika.BasicProperties(
            headers={"x-retry-index": last_index},
            delivery_mode=pika.spec.PERSISTENT_DELIVERY_MODE,
        ),
    )

    ch.basic_ack(delivery_tag=method.delivery_tag)


def main():
    global smtpObj
    global tpl_environment
    global env
    global channel
    global EMAIL_ADDRESS

    logging.basicConfig(level=logging.INFO)
    logging.getLogger('pika').setLevel(logging.WARNING)

    tpl_environment = create_template_environment()
    env = os.environ.get("ENV") or 'development'
    EMAIL_ADDRESS = os.environ.get("EMAIL_ADDRESS")

    RABBITMQ_HOST = os.environ.get("RABBITMQ_HOST", "rabbit")
    RABBITMQ_USER = os.environ.get("RABBITMQ_USER", "guest")
    RABBITMQ_PASS = os.environ.get("RABBITMQ_PASS", "guest")

    credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASS)
    connection = pika.BlockingConnection(
        pika.ConnectionParameters(
            host=RABBITMQ_HOST,
            credentials=credentials,
            # Keep-alive interval (seconds). Without this, idle connections can be
            # silently dropped by firewalls or NAT, causing a StreamLostError mid-consume.
            heartbeat=600,
        )
    )
    channel = connection.channel()

    channel.exchange_declare(exchange='eml',
                             exchange_type='direct',
                             durable=True)
    channel.queue_declare(queue='email',
                          arguments={
                              'x-dead-letter-exchange': "dead_letter_exchange",
                              'x-dead-letter-routing-key': "dead_letter_routing_key",
                              'x-death-header': True,
                          },
                          durable=True)
    channel.queue_bind(exchange='eml',
                       queue='email',
                       routing_key='mail')

    # channel.basic_qos(prefetch_count=1) is intentionally disabled.
    # With prefetch=1 a single stuck message would block all others from being delivered
    # to this consumer. Because we use a single-threaded BlockingConnection, the benefit
    # (backpressure) is outweighed by the risk of a full queue stall.
    # Revisit if the dispatcher is ever scaled to multiple worker processes.

    channel.exchange_declare(exchange="dead_letter_exchange",
                             exchange_type='direct',
                             durable=True)
    channel.queue_declare(queue='error_queue',
                          durable=True)
    channel.queue_bind(exchange='dead_letter_exchange',
                       queue='error_queue',
                       routing_key='dead_letter_routing_key')

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

    channel.basic_consume(queue='email',
                          auto_ack=False,
                          on_message_callback=send_email)
    channel.basic_consume(queue='error_queue',
                          auto_ack=False,
                          on_message_callback=process_dead_letter_messages)

    logging.info(' [*] Connecting to smtp')
    connect_to_smtp()
    logging.info(' [*] Waiting for messages. To exit press CTRL+C')
    channel.start_consuming()


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        logging.error('Interrupted')
        if smtpObj is not None:
            smtpObj.quit()
        try:
            sys.exit(0)
        except SystemExit:
            os._exit(0)
