import pika
import json
import smtplib
from email.message import EmailMessage
from jinja2 import Environment, FileSystemLoader

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
    email = EmailMessage()
    email['From'] = msg['from']
    email['Reply-To'] = msg['reply_to']
    email['To'] = msg['to']
    email['Subject'] = msg['subject']
    template = environment.get_template(f"{msg['template']}.jinja2")
    rendered = template.render(msg['parameters'], altro=msg['subject'])
    email.set_content(rendered, subtype='html')
    smtpObj.send_message(email)

channel.basic_consume(queue='email',
                      auto_ack=True,
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

