import pika
import json
import smtplib
from email.message import EmailMessage
from jinja2 import Environment, FileSystemLoader, exceptions

"""
continuously polls(*) the email queue and renders+sends the template on every acked message
(*) = waits for the queue to push a message onto the app
"""

environment = Environment(loader=FileSystemLoader("../templates/"))

EMAIL_HOST='mailhog' #FIXME differentiate between dev and prod
smtpObj = smtplib.SMTP( EMAIL_HOST, 1025 )

RABBIT_HOST='rabbit'
connection = pika.BlockingConnection(pika.ConnectionParameters(RABBIT_HOST))
channel = connection.channel()

channel.exchange_declare(exchange='eml',
                         exchange_type='direct',
                         durable=True)
channel.queue_declare(queue='email',
                      arguments={
                        'x-dead-letter-exchange': "dead_letter_exchange",
                        'x-dead-letter-routing-key': "dead_letterl_routing_key",
                        'x-death-header': True,
                      },
                      durable=True)
channel.queue_bind(exchange='eml',
                   queue='email',
                   routing_key='mail')

#channel.basic_qos(prefetch_count=1) #TODO: notice that an error processing a message will BLOCK the others from being processed

channel.exchange_declare(exchange="dead_letter_exchange",
                         exchange_type='direct',
                         durable=True)
channel.queue_declare(queue='error_queue',
                      durable=True)
channel.queue_bind(exchange='dead_letter_exchange',
                   queue='error_queue',
                   routing_key='dead_letterl_routing_key')

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

def send_email(ch, method, properties, body):
    """
    Callback for the NORMAL MESSAGE
    Output: send an email
        OR
    Output: Dead-letter queue
    """
    msg = json.loads(body)

    try:
        template = environment.get_template(f"{msg['template']}.jinja2")
    except exceptions.TemplateNotFound:
        # TODO: send a notification to someone about adding a template
        # NOTE: this is a requeuable message
        print(f"Template {msg['template']}.jinja2 not found")
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
        return

    try:
        rendered = template.render(msg['parameters'], altro=msg['subject'])
    except exceptions.UndefinedError as e:
        # NOTE: this is a NON-requeuable message
        print(f"Error in rendering: some parameter is undefined (error: {e}; message: {msg})")
# TODO: check if there is no x-header about DLQ if
# i send directly to queue from this (i.e. without passing from DLQ),
        # headers = {
        #     'reason': 'parameter_undefined',
        #     'x-delay': '60000',
        # }
        # prop = pika.BasicProperties(
        #     headers=headers,
        #     delivery_mode = pika.spec.PERSISTENT_DELIVERY_MODE,
        #     )
        # channel.basic_publish(exchange='wait_exchange',
        #                   routing_key='wait',
        #                   body=body,
        #                   properties=prop)
        # ch.basic_ack(delivery_tag=method.delivery_tag)

        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
        return
    except exceptions.TemplateNotFound:
        # NOTE: this is a requeuable message
        print(f"A sub-template in {msg['template']}.jinja2 was not found")
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
        return

    email = EmailMessage()
    email.set_content(rendered, subtype='html')
    email['From'] = msg['from']
    email['Reply-To'] = msg['reply_to']
    email['To'] = msg['to']
    email['Subject'] = msg['subject']
    smtpObj.send_message(email) #TODO handle case in which smtp not ready
    ch.basic_ack(delivery_tag = method.delivery_tag)

def process_dead_letter_messages(ch, method, properties, body):
    """
    Callback for the ERROR MESSAGE
    Output: Requeue on delayed exchange (if error about missing template)
        OR
    Output: Remove (if error about unretrievable data)
    #TODO I can't know which is the case, with the current design
    """
    REQUEUE_DELAY_DURATIONS = [
        5 * 60000, # 5 mins
        50 * 60000, # 50 mins
        5*60 * 60000, # 5 hrs
        5*60*10 * 60000, # 50 hrs
        5*60*20 * 60000, # 100 hrs
    ]
    wait_for = REQUEUE_DELAY_DURATIONS[4]
    wait_for = '15000'

    print(f'DLQ')
    print(properties.headers)
    print(f'Message was in "{properties.headers["x-first-death-exchange"]}" (specifically "{properties.headers["x-first-death-queue"]}" queue) and was rejected because: {properties.headers["x-first-death-reason"]}')
    print()

    headers = {
            #'reason': 'parameter_undefined',
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
    Output: Remove (if limit time reached) #TODO
    """

    print(f'REQUEUE-WAIT')
    print(properties.headers)
    print(f'Message was in "{properties.headers["x-first-death-exchange"]}" (specifically "{properties.headers["x-first-death-queue"]}" queue) and was rejected because: {properties.headers["x-first-death-reason"]}')
    print()

    channel.basic_publish(exchange='eml',
                          routing_key='mail',
                          body=body,
                          properties=pika.BasicProperties(
                              delivery_mode = pika.spec.PERSISTENT_DELIVERY_MODE,
                          ))
    ch.basic_ack(delivery_tag = method.delivery_tag)

channel.basic_consume(queue='email',
                      auto_ack=False,
                      on_message_callback=send_email)

channel.basic_consume(queue='error_queue',
                      auto_ack=False,
                      on_message_callback=process_dead_letter_messages)

channel.basic_consume(queue='requeue_queue',
                      auto_ack=False,
                      on_message_callback=process_requeue)


print(' [*] Waiting for messages. To exit press CTRL+C')
channel.start_consuming()

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('Interrupted')
        smtpObj.quit()
        try:
            sys.exit(0)
        except SystemExit:
            os._exit(0)

