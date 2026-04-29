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
from jinja2 import Environment, FileSystemLoader, exceptions

from notify import slack_alert


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


# Exponential-backoff delay tiers (milliseconds) used by the wait_exchange retry mechanism.
# IMPORTANT: this list is the single source of truth — do not duplicate it.
# Each tier corresponds to one retry attempt; the index is stored in the x-delay header.
# See README § "Migrating away from rabbitmq-delayed-message-exchange" for the DLX+TTL
# replacement that will be needed before upgrading to RabbitMQ 4.x.
REQUEUE_DELAY_DURATIONS = [
    5        * 60_000,   # attempt 1:  5 min
    50       * 60_000,   # attempt 2: 50 min
    5  * 60  * 60_000,   # attempt 3:  5 h
    50 * 60  * 60_000,   # attempt 4: 50 h
    100 * 60 * 60_000,   # attempt 5: 100 h  ← last attempt, operator alerted
]

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
    current_delay = properties.headers.get("x-delay") if properties.headers else 0
    try:
        index = REQUEUE_DELAY_DURATIONS.index(int(current_delay))
    except ValueError:
        index = -1

    next_index = index + 1

    if next_index >= len(REQUEUE_DELAY_DURATIONS):
        logging.warning('Max retry time hit, dropping message')
        slack_alert(f"Time over, a message was dropped ({reason})", submessage=":poop:")
        ch.basic_ack(delivery_tag=method.delivery_tag)
        return

    wait = REQUEUE_DELAY_DURATIONS[next_index]
    retry_message = f'Retry attempt {next_index + 1}/{len(REQUEUE_DELAY_DURATIONS)} will happen in {int(wait/1000)} sec'
    logging.info(retry_message)
    last_chance = ''
    if next_index + 1 == len(REQUEUE_DELAY_DURATIONS):
        last_chance = f'-- LAST ATTEMPT TO FIX: within {int(wait/1000)} sec {ONCALL_HANDLER}'
        logging.error(last_chance)
    slack_alert(f"A template is missing! ({reason})",
                submessage=retry_message + " " + last_chance)

    headers = {
        'reason': reason,
        'x-delay': wait,
    }
    prop = pika.BasicProperties(
        headers=headers,
        delivery_mode=pika.spec.PERSISTENT_DELIVERY_MODE,
    )
    # Publish a *new* message carrying the original body rather than NACKing.
    # NACK with requeue=True would cause an immediate retry loop; NACK with requeue=False
    # would send it to the DLQ. Neither gives us the exponential backoff we want.
    # See https://stackoverflow.com/a/58500336
    channel.basic_publish(exchange='wait_exchange',
                          routing_key='wait',
                          body=body,
                          properties=prop)
    ch.basic_ack(delivery_tag=method.delivery_tag)


def send_email(ch, method, properties, body):
    """
    Callback for the NORMAL MESSAGE.
    Output: send an email
        OR
    Output: publish to wait_exchange (template missing or rendering error)
    """
    msg = json.loads(body)

    missing = validate_message(msg)
    if missing:
        logging.error(f"Dropping malformed message: missing fields {missing}. Body: {body}")
        slack_alert(f"Malformed message dropped: missing fields {missing}",
                    submessage="The producer sent an incomplete payload. Check the sending service.")
        ch.basic_ack(delivery_tag=method.delivery_tag)
        return

    try:
        template = tpl_environment.get_template(f"{msg['template']}.jinja2")
    except exceptions.TemplateNotFound:
        logging.error(f"Template {msg['template']}.jinja2 not found")
        # Requeuable: the template may be deployed while the message is waiting.
        requeue_wait(ch, method, properties, body, reason=f"template_not_found-{msg['template']}")
        return

    try:
        rendered = template.render(msg['parameters'], altro=msg['subject'])
    except exceptions.UndefinedError as e:
        logging.error(f"Error in rendering: some parameter is undefined (error: {e}; message: {msg})")
        # NON-requeuable: the payload is malformed and retrying will never fix it.
        requeue_wait(ch, method, properties, body, reason="parameter_undefined")
        return
    except exceptions.TemplateNotFound:
        logging.error(f"A sub-template in {msg['template']}.jinja2 was not found")
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
        email = EmailMessage()
        email.set_content(rendered, subtype='html')
        email['From'] = msg.get('from') or EMAIL_ADDRESS or ''
        email['To'] = msg['to']
        email['Subject'] = msg['subject']
        if msg.get('reply_to'):
            email['Reply-To'] = msg['reply_to']
        if msg.get('cc'):
            cc = msg['cc']
            email['Cc'] = ', '.join(cc) if isinstance(cc, list) else cc
        if msg.get('bcc'):
            bcc = msg['bcc']
            email['Bcc'] = ', '.join(bcc) if isinstance(bcc, list) else bcc
        smtpObj.send_message(email)
        ch.basic_ack(delivery_tag=method.delivery_tag)
    except smtplib.SMTPServerDisconnected:
        # Do not ack/nack: pika will re-deliver the message once the connection
        # is re-established or the channel is re-opened.
        logging.error("Server unexpectedly disconnected. Attempting to reconnect")
        connect_to_smtp()
    except smtplib.SMTPResponseException as e:
        logging.error(f"SMTP error occurred: {e.smtp_code} - {e.smtp_error}")
    except Exception as e:
        logging.error(f"An unexpected error occurred: {e}")


def process_dead_letter_messages(ch, method, properties, body):
    """
    Callback for the ERROR MESSAGE (dead-letter queue).
    This queue should normally stay empty. Its presence is a safety net: if a message
    somehow ends up here (unexpected NACK), we push it into the wait loop at the maximum
    delay so an operator has time to investigate before it is retried.

    See https://stackoverflow.com/a/58500336 on why we republish instead of NACKing.
    """
    wait_for = REQUEUE_DELAY_DURATIONS[-1]

    logging.error("DLQ handler triggered — a message ended up in error_queue unexpectedly.")
    slack_alert("For some reason there's the DLQ handler that was triggered!")

    headers = {'x-delay': wait_for}
    fullheaders = {**properties.headers, **headers}
    prop = pika.BasicProperties(
        headers=fullheaders,
        delivery_mode=pika.spec.PERSISTENT_DELIVERY_MODE,
    )
    channel.basic_publish(exchange='wait_exchange',
                          routing_key='wait',
                          body=body,
                          properties=prop)

    ch.basic_ack(delivery_tag=method.delivery_tag)


def process_requeue(ch, method, properties, body):
    """
    Callback for WAITING MESSAGES (requeue_queue).
    Output: re-enqueue on eml exchange (if the error was a missing template — fixable)
        OR
    Output: drop (if the error was a malformed payload — not fixable by retrying)
    """

    if properties.headers["reason"] == 'parameter_undefined':
        # The payload is structurally wrong (missing field). Retrying will never succeed,
        # so we drop the message. The original error was already logged in send_email.
        logging.warning('Impossible to fix error, dropping message')
        ch.basic_ack(delivery_tag=method.delivery_tag)
        return

    channel.basic_publish(exchange='eml',
                          routing_key='mail',
                          body=body,
                          properties=pika.BasicProperties(
                              headers=properties.headers,  # carry x-delay forward to detect the retry tier
                              delivery_mode=pika.spec.PERSISTENT_DELIVERY_MODE,
                          ))
    ch.basic_ack(delivery_tag=method.delivery_tag)


def main():
    global smtpObj
    global tpl_environment
    global env
    global channel
    global EMAIL_ADDRESS

    logging.basicConfig(level=logging.INFO)
    logging.getLogger('pika').setLevel(logging.WARNING)

    def _jinja2_finalize(value):
        if value is None:
            return ''
        if isinstance(value, bool):
            return str(value).lower()
        return value

    tpl_environment = Environment(loader=FileSystemLoader(_TEMPLATES_DIR), finalize=_jinja2_finalize)
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

    channel.exchange_declare(exchange="wait_exchange",
                             exchange_type='x-delayed-message',
                             durable=True,
                             arguments={"x-delayed-type": "direct"})
    channel.queue_declare(queue='requeue_queue',
                          durable=True)
    channel.queue_bind(exchange='wait_exchange',
                       queue='requeue_queue',
                       routing_key='wait')

    channel.basic_consume(queue='email',
                          auto_ack=False,
                          on_message_callback=send_email)
    channel.basic_consume(queue='error_queue',
                          auto_ack=False,
                          on_message_callback=process_dead_letter_messages)
    channel.basic_consume(queue='requeue_queue',
                          auto_ack=False,
                          on_message_callback=process_requeue)

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
