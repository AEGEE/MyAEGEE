import pika
import json
import smtplib
from email.message import EmailMessage
from jinja2 import Environment, FileSystemLoader, exceptions

"""
continuously polls the email queue and renders+sends the template on every acked message
"""

environment = Environment(loader=FileSystemLoader("../templates/"))

EMAIL_HOST='172.18.0.13' #FIXME
smtpObj = smtplib.SMTP( EMAIL_HOST, 1025 )

RABBIT_HOST='172.18.0.11' #FIXME
connection = pika.BlockingConnection(pika.ConnectionParameters(RABBIT_HOST))
channel = connection.channel()

channel.queue_declare(queue='email')

def send_email(ch, method, properties, body):
    msg = json.loads(body)
    try:
        template = environment.get_template(f"{msg['template']}.jinja2")
    except exceptions.TemplateNotFound:
        return
    # TODO: check if there is an auto-delete after 30 minutes for stuck un-acked messages
    # TODO: add auto-retry. rabbit is smart and doesn't let me process a message again unless i force it
    rendered = template.render(msg['parameters'], altro=msg['subject'])

    email = EmailMessage()
    email.set_content(rendered, subtype='html')
    email['From'] = msg['from']
    email['Reply-To'] = msg['reply_to']
    email['To'] = msg['to']
    email['Subject'] = msg['subject']
    smtpObj.send_message(email)
    ch.basic_ack(delivery_tag = method.delivery_tag)

channel.basic_consume(queue='email',
                      auto_ack=False,
                      on_message_callback=send_email)

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

