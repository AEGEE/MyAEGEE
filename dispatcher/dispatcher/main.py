import pika
import json
import smtplib
from email.message import EmailMessage
from jinja2 import Environment, FileSystemLoader, exceptions
import os
import sys
import logging

"""
continuously polls(*) the email queue and renders+sends the template on every acked message
(*) = waits for the queue to push a message onto the app
"""

def connect_to_smtp():
    global smtpObj

    EMAIL_HOST='mailhog'
    EMAIL_PORT=1025
    EMAIL_ADDRESS=None
    EMAIL_PASSWORD=None

    if env == 'production':
        EMAIL_HOST= os.environ.get("EMAIL_HOST")
        EMAIL_PORT= os.environ.get("EMAIL_PORT")
        EMAIL_ADDRESS= os.environ.get("EMAIL_ADDRESS")
        EMAIL_PASSWORD= os.environ.get("EMAIL_PASSWORD")

    try:
        smtpObj = smtplib.SMTP( EMAIL_HOST, EMAIL_PORT )

        if env == 'production':
            # we have to upgrade the connection and login
            # (At least with ethereal.email.. didn't try with gmail!) #TODO
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
    REQUEUE_DELAY_DURATIONS = [
        5 * 60000, # 5 mins
        50 * 60000, # 50 mins
        5*60 * 60000, # 5 hrs
        5*60*10 * 60000, # 50 hrs
        5*60*20 * 60000, # 100 hrs
    ]

    current_delay = properties.headers.get("x-delay") if properties.headers else 0
    try:
        index = REQUEUE_DELAY_DURATIONS.index(int(current_delay))
    except ValueError:
        index = -1

    next_index = index + 1

    if next_index >= len(REQUEUE_DELAY_DURATIONS):
        logging.warning('Max retry time hit, dropping message')
        # TODO: notify someone that they've been sloppy
        ch.basic_ack(delivery_tag=method.delivery_tag)
        return

    wait = REQUEUE_DELAY_DURATIONS[next_index]
    logging.info(f'Retry attempt {next_index + 1}/{len(REQUEUE_DELAY_DURATIONS)} in {int(wait/1000)} sec')
    if next_index + 1 == len(REQUEUE_DELAY_DURATIONS):
        logging.error(f'LAST ATTEMPT TO FIX: within {int(wait/1000)} sec')

    headers = {
        'reason': reason,
        'x-delay': wait,
    }
    prop = pika.BasicProperties(
        headers=headers,
        delivery_mode = pika.spec.PERSISTENT_DELIVERY_MODE,
        )
    channel.basic_publish(exchange='wait_exchange',
                        routing_key='wait',
                        body=body,
                        properties=prop) #NOTE it completely ignores the previous properties (and it's fine)
    ch.basic_ack(delivery_tag=method.delivery_tag)

def send_email(ch, method, properties, body):
    """
    Callback for the NORMAL MESSAGE
    Output: send an email
        OR
    Output: Wait-exchange
    """
    msg = json.loads(body)

    try:
        template = tpl_environment.get_template(f"{msg['template']}.jinja2")
    except exceptions.TemplateNotFound:
        # TODO: send a notification to someone about adding a template
        # NOTE: this is a requeuable message
        logging.error(f"Template {msg['template']}.jinja2 not found")
        requeue_wait(ch, method, properties, body, reason="template_not_found")
        return

    try:
        rendered = template.render(msg['parameters'], altro=msg['subject'])
    except exceptions.UndefinedError as e:
        # NOTE: this is a NON-requeuable message
        logging.error(f"Error in rendering: some parameter is undefined (error: {e}; message: {msg})")
        requeue_wait(ch, method, properties, body, reason="parameter_undefined")
        return
    except exceptions.TemplateNotFound:
        # NOTE: this is a requeuable message
        logging.error(f"A sub-template in {msg['template']}.jinja2 was not found")
        requeue_wait(ch, method, properties, body, reason="sub-template_not_found")
        return

    try:
        email = EmailMessage()
        email.set_content(rendered, subtype='html')
        email['From'] = msg['from']
        email['Reply-To'] = msg['reply_to']
        email['To'] = msg['to']
        email['Subject'] = msg['subject']
        smtpObj.send_message(email)
        ch.basic_ack(delivery_tag = method.delivery_tag)
    except smtplib.SMTPServerDisconnected:
        logging.error("Server unexpectedly disconnected. Attempting to reconnect")
        connect_to_smtp()
    except smtplib.SMTPResponseException as e:
        logging.error(f"SMTP error occurred: {e.smtp_code} - {e.smtp_error}")
    except Exception as e:
        logging.error(f"An unexpected error occurred: {e}")

def process_dead_letter_messages(ch, method, properties, body):
    """
    Callback for the ERROR MESSAGE
    Output: none yet. I don't expect for messages to fall here, I keep the DLQ for safety

    @see https://stackoverflow.com/a/58500336
    "The way to do this is not to use NACK at all but to generate and return a 'new' message
    (which is simply the current message you are handling, but adding new headers to it).
    It appears that a NACK is basically doing this anyway according to the AMQP spec."
    """
    REQUEUE_DELAY_DURATIONS = [
        5 * 60000, # 5 mins
        50 * 60000, # 50 mins
        5*60 * 60000, # 5 hrs
        5*60*10 * 60000, # 50 hrs
        5*60*20 * 60000, # 100 hrs
    ] #TODO: why is this here again?
    wait_for = REQUEUE_DELAY_DURATIONS[-1]

    headers = {
            'x-delay': wait_for,
        }
    fullheaders = {**properties.headers, **headers}
    prop = pika.BasicProperties(
        headers=fullheaders,
        delivery_mode = pika.spec.PERSISTENT_DELIVERY_MODE,
        )
    channel.basic_publish(exchange='wait_exchange',
                        routing_key='wait',
                        body=body,
                        properties=prop)

    ch.basic_ack(delivery_tag = method.delivery_tag)

def process_requeue(ch, method, properties, body):
    """
    Callback for the WAITING MESSAGES
    Output: Requeue on normal exchange (if error about missing template)
        OR
    Output: Remove (if unfixable error)
    """

    if (properties.headers["reason"] == 'parameter_undefined'):
        logging.warn('Impossible to fix error, dropping message')
        #TODO output something/notify to leave a trail for better debugging on what was missing
        ch.basic_ack(delivery_tag = method.delivery_tag)
        return

    channel.basic_publish(exchange='eml',
                          routing_key='mail',
                          body=body,
                          properties=pika.BasicProperties(
                              headers = properties.headers, # propagation to avoid endless loop
                              delivery_mode = pika.spec.PERSISTENT_DELIVERY_MODE,
                          ))
    ch.basic_ack(delivery_tag = method.delivery_tag)

def main():
    global smtpObj
    global tpl_environment
    global env
    global channel

    # Configure logging for this app, and remove "info" of pika
    logging.basicConfig(level=logging.INFO)
    logging.getLogger('pika').setLevel(logging.WARNING)

    tpl_environment = Environment(loader=FileSystemLoader("../templates/"))
    env = os.environ.get("ENV") or 'development'

    RABBIT_HOST='rabbit'
    connection = pika.BlockingConnection(pika.ConnectionParameters(RABBIT_HOST))
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

    #channel.basic_qos(prefetch_count=1) #TODO: notice that with this enabled, an error processing a message will BLOCK the others from being processed

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
                            arguments={"x-delayed-type": "direct"}
                            )
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
        smtpObj.quit()
        try:
            sys.exit(0)
        except SystemExit:
            os._exit(0)

