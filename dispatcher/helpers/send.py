import pika
import json
import random

"""
creates between 1 and 8 fake emails and puts in the queue
"""

from faker import Faker
faker = Faker()

RANDOM_AMOUNT_TEST=False
ALL_TEMPLATES_TEST=True

BODIES_LIST = [ "ITC", "HRC", "CC", "SomeCommission", "JC", "DPC", "MedCom" ]
# from constants.js
MAIL_SUBJECTS = {
    "CORE": {
        "MAIL_CONFIRMATION": 'MyAEGEE: Please confirm your account',
        "MAIL_CHANGE": 'MyAEGEE: Email change',
        "PASSWORD_RESET": 'MyAEGEE: Password reset request',
        "NEW_JOIN_REQUEST": 'MyAEGEE: New join request for your body',
        "NEW_MEMBER": 'MyAEGEE: Welcome to AEGEE'
    },
    #"EVENTS": {},
}
# should exist in constants.js but it does not yet.
# anyway here one could #TODO a smarter way: look into the filesystem
MAIL_TEMPLATES = {
    "CORE": {
        "MAIL_CONFIRMATION": 'confirm_email',
        "MAIL_CHANGE": 'mail_change',
        "PASSWORD_RESET": 'password_reset',
        "NEW_JOIN_REQUEST": 'member_joined',
        "NEW_MEMBER": 'new_member'
    },
    #"EVENTS": {},
}

RABBIT_HOST='172.18.0.8' #FIXME
connection = pika.BlockingConnection(pika.ConnectionParameters(RABBIT_HOST))
channel = connection.channel()

channel.exchange_declare(exchange='eml',
                         exchange_type='direct',
                         durable=True)
channel.queue_declare(queue='email', durable=True)
channel.queue_bind(exchange='eml',
                   queue='email',
                   routing_key='mail')

def generate_fake_payload(subj="", template=""):
    email = {
        "from": "mailer@aegee.eu",
        "to": [faker.email() for _ in range(random.randrange(1,3))],
        "reply_to": "noreply@aegee.eu",
        "subject": subj or faker.sentence(),
        "template": template or "new_member_dynamic", #TODO remove the or/make it fail
        "parameters": { # Not all will be used at the same time but this is not important, it's a test
            "member_firstname": faker.first_name(),
            "member_lastname": faker.last_name(),
            "body": f"AEGEE-{faker.city()}",
            "last_payment": faker.date(),
            "body_name": random.choice(BODIES_LIST),
            "body_id": random.choice(range(random.randrange(10,70))),
            "place": faker.city(),
            "token": faker.md5(),
        }
    }
    return email


if(RANDOM_AMOUNT_TEST):
    for _ in range(random.randrange(1,8)):
        email = generate_fake_payload()
        channel.basic_publish(exchange='eml',
                            routing_key='mail',
                            body=json.dumps(email),
                            properties=pika.BasicProperties(
                                delivery_mode = pika.spec.PERSISTENT_DELIVERY_MODE
                            ))
        print(f" [x] Sent {email['subject']} (to {email['to']})")

if(ALL_TEMPLATES_TEST):
    for ms in MAIL_TEMPLATES:
        for case in MAIL_TEMPLATES[ms]:
            email = generate_fake_payload(MAIL_SUBJECTS[ms][case], MAIL_TEMPLATES[ms][case])
            channel.basic_publish(exchange='eml',
                                routing_key='mail',
                                body=json.dumps(email),
                                properties=pika.BasicProperties(
                                    delivery_mode = pika.spec.PERSISTENT_DELIVERY_MODE
                                ))
            print(f" [x] Sent {email['subject']}")

connection.close()
