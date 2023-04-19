import pika
import json
import random

"""
creates between 1 and 8 fake emails and puts in the queue
"""

from faker import Faker
faker = Faker()

RABBIT_HOST='172.18.0.8' #FIXME
connection = pika.BlockingConnection(pika.ConnectionParameters(RABBIT_HOST))
channel = connection.channel()
channel.queue_declare(queue='email', durable=True)

def generate_fake_payload():
    email = {
        "from": "mailer@aegee.eu",
        "to": [faker.email() for _ in range(random.randrange(1,3))],
        "reply_to": "noreply@aegee.eu",
        "subject": faker.sentence(),
        "template": "new_member_dynamic",
        "parameters": { # Not all will be used at the same time but this is not important, it's a test
            "member_firstname": faker.first_name(),
            "body": f"AEGEE-{faker.city()}",
            "last_payment": faker.date(),
            "body_name": faker.language_name(),
            "place": faker.ssn(),
        }
    }
    return email

for _ in range(random.randrange(1,8)):
    email = generate_fake_payload()
    channel.basic_publish(exchange='',
                        routing_key='email',
                        body=json.dumps(email),
                        properties=pika.BasicProperties(
                            delivery_mode = pika.spec.PERSISTENT_DELIVERY_MODE
                        ))
    print(f" [x] Sent {email['subject']} (to {email['to']})")



connection.close()
