import pika
import json
import random
import os

"""
creates between 1 and 8 fake emails and puts in the queue
OR
tests all templates it finds in the folder
"""

from faker import Faker
faker = Faker()

ERROR_TEST=True
RANDOM_AMOUNT_TEST=False
MIN_MSG=1
MAX_MSG=8
ALL_TEMPLATES_TEST=True

BODIES_LIST = [ "ITC", "HRC", "CC", "SomeCommission", "JC", "DPC", "MedCom" ]
su_words_list = ['summer', 'awesome', 'your', 'now', 'sustainability', 'culture', 'europe', 'balkan', 'russia', 'adventure', 'ukraine', 'capital', 'montenegro', 'ireland', 'serbia', 'crimea', 'amazing', 'slavaukraini', 'heroiamslava']
def su_sentence():
    return faker.sentence(nb_words=5, ext_word_list=su_words_list)
def agora_sentence():
    return f"Agora {faker.sentence(nb_words=1)}"

# from constants.js (at least for core..)
MAIL_SUBJECTS = {
    "CORE": {
        "MAIL_CONFIRMATION": 'MyAEGEE: Please confirm your account',
        "MAIL_CHANGE": 'MyAEGEE: Email change',
        "PASSWORD_RESET": 'MyAEGEE: Password reset request',
        "NEW_JOIN_REQUEST": 'MyAEGEE: New join request for your body',
        "NEW_MEMBER": 'MyAEGEE: Welcome to AEGEE'
    },
    "EVENTS": {
        "MAIL_APPLIED": f"You've successfully applied for {su_sentence()}",
        "MAIL_UPDATED": f"Your application for {su_sentence()} was updated",
        "MAIL_EVENT_CREATED": "The event was created",
        "MAIL_EVENT_UPDATED": "The event was updated",
        "MAIL_EVENT_STATUS_CHANGED": "Your event's status was changed",
        "MAIL_EVENT_SUBMITTED": "An event was submitted",
    },
    "STATUTORY": {
        "MAIL_APPLIED": f"You've successfully applied for {agora_sentence()}",
        "MAIL_UPDATED": f"Your application for {agora_sentence()} was updated",
        "MAIL_APPLIED_BOARD": f"One of your body members has applied to {agora_sentence()}",
        "MAIL_UPDATED_BOARD": f"One of your body members has updated their application to {agora_sentence()}",
        "MAIL_CANDIDATE_APPLIED": "A new application was submitted",
        "MAIL_MEMBERSLIST_SUBMITTED": "The event was updated",
        "MAIL_MEMBERSLIST_EDITED": f"A memberslist has been edited for {agora_sentence()}",
    },
    "SUMMERUNIVERSITIES": {
        "MAIL_APPLIED_MEMBER": f"You've successfully applied for {su_sentence()}",
        "MAIL_APPLIED_ORGANISERS": f"Somebody has applied for {su_sentence()}",
        "MAIL_APPLIED_BOARD": f"One of your body members has applied to {su_sentence()}",
        "MAIL_UPDATED_MEMBER": f"Your application for {su_sentence()} was updated",
        "MAIL_UPDATED_ORGANISERS": f"Somebody has updated their application for {su_sentence()}",
        "MAIL_UPDATED_BOARD": f"One of your body members has updated their application to {su_sentence()}",
        "MAIL_APPL_STATUS_CHANGED": f"Your application status for {su_sentence()} was updated",
        "MAIL_SU_CREATED": "The event was created",
        "MAIL_SU_UPDATED": "The event was updated",
        "MAIL_SU_STATUS_CHANGED": "Your event's status was changed",
        "MAIL_SU_SUBMITTED": "An event was submitted",
    },
    "NETWORK": {
        "MAIL_NEW_BOARD": f'A new board was added for { random.choice(BODIES_LIST) }',
    },
    "OTHER": {
        "MAIL_EXPIRED_MEMBERSHIP": 'member_expired',
        "MAIL_CUSTOM": 'custom',
    },
}
# should exist in constants.js but it does not yet.
# anyway here one could make it in a smarter way: look into the filesystem
# but then you miss the correspondence between the subject and the template.
# So we only look in the fs to cross-check if we were thorough
MAIL_TEMPLATES = {
    "CORE": {
        "MAIL_CONFIRMATION": 'confirm_email',
        "MAIL_CHANGE": 'mail_change',
        "PASSWORD_RESET": 'password_reset',
        "NEW_JOIN_REQUEST": 'member_joined',
        "NEW_MEMBER": 'new_member'
    },
    "EVENTS": {
        "MAIL_APPLIED": "events_applied",
        "MAIL_UPDATED": "events_edited",
        "MAIL_EVENT_CREATED": "events_event_created",
        "MAIL_EVENT_UPDATED": "events_event_updated",
        "MAIL_EVENT_STATUS_CHANGED": "events_status_changed",
        "MAIL_EVENT_SUBMITTED": "events_submitted",
    },
    "STATUTORY": {
        "MAIL_APPLIED": "statutory_applied",
        "MAIL_UPDATED": "statutory_edited",
        "MAIL_APPLIED_BOARD": "statutory_board_applied",
        "MAIL_UPDATED_BOARD": "statutory_board_edited",
        "MAIL_CANDIDATE_APPLIED": "candidate_applied",
        "MAIL_MEMBERSLIST_SUBMITTED": "statutory_memberslist_submitted",
        "MAIL_MEMBERSLIST_EDITED": "statutory_memberslist_edited",
    },
    "SUMMERUNIVERSITIES": {
        "MAIL_APPLIED_MEMBER": "summeruniversity_applied",
        "MAIL_APPLIED_ORGANISERS": "summeruniversity_organizer_applied",
        "MAIL_APPLIED_BOARD": "summeruniversity_board_applied",
        "MAIL_UPDATED_MEMBER": "summeruniversity_application_edited",
        "MAIL_UPDATED_ORGANISERS": "summeruniversity_organizer_edited",
        "MAIL_UPDATED_BOARD": "summeruniversity_board_edited",
        "MAIL_APPL_STATUS_CHANGED": "summeruniversity_application_status_updated",
        "MAIL_SU_CREATED": "summeruniversity_event_created",
        "MAIL_SU_UPDATED": "summeruniversity_event_updated",
        "MAIL_SU_STATUS_CHANGED": "summeruniversity_status_changed",
        "MAIL_SU_SUBMITTED": "summeruniversity_submitted",
    },
    "NETWORK": {
        "MAIL_NEW_BOARD": 'network_new_board',
    },
    "OTHER": {
        "MAIL_EXPIRED_MEMBERSHIP": 'member_expired',
        "MAIL_CUSTOM": 'custom',
    },
}

RABBIT_HOST="172.18.0.X" #FIXME (as this is a python script launched on host we cant use docker's dns)
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

def generate_fake_payload(subj="", template="", return_malformed_mail=False):
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
            "body_name": random.choice(BODIES_LIST), #note: discrepancy in the microservices on the use of body vs body_name
            "body_id": random.choice(range(random.randrange(10,70))),
            "place": faker.city(),
            "token": faker.md5(),
            "old_status": "snafu",
            "event_name": agora_sentence(),
            "membership_fee": "15⎊",
            "board": {
                "elected_date": "yesteeeerday",
                "start_date": "tomooorrow",
                "end_date": "next weeeeek",
                "message": "chattanooga",
            },
            "event": {
                "name": su_sentence(),
                "location": faker.city(),
                "url": "example.org",
                "status": "damned",
                "questions": [
                    { "description": "Who are you?" },
                    { "description": "What is the answer to life ...etc?" },
                    ],
            },
            "application": {
                "first_name": faker.first_name(),
                "last_name": faker.last_name(),
                "body_name": random.choice(BODIES_LIST),
                "created_at": "yesterday or whatever",
                "updated_at": "now more or less",
                "aegee_experience": "I suck",
                "ideal_su": "I get to suck",
                "motivation": "I wanna suck",
                "status": "totally snafu",
                "email": "someone@example.org",
                "gender": "Robot",
                "date_of_birth": "1985-04-16",
                "nationality": "Europe",
                "meals": "Steak",
                "allergies": "wallopers",
                "number_of_events_visited": "over 9000",
                "visa_required": "No",
                "answers": [
                    "ho-hoo, ho-hoo",
                    "42",
                    ],
            },
            "candidate": {
                "first_name": faker.first_name(),
                "last_name": faker.last_name(),
            },
            "position": {
                "event_id": "42",
                "name": "This gran C commissioner",
            },
            "body": """
                <ul>
                    <li><strong>Who is cool: </strong>Accountable people</li>
                    <li><strong>Who is not: </strong>People hiding behind the excuse of 'volunteer'</li>
                </ul>
            """
        }
    }
    if(return_malformed_mail):
        email["template"] = MAIL_TEMPLATES["EVENTS"]["MAIL_EVENT_UPDATED"]
        del email["parameters"]["event"]
    return email


if(RANDOM_AMOUNT_TEST):
    amount = random.randrange(MIN_MSG,MAX_MSG)
    for _ in range(amount):
        email = generate_fake_payload()
        channel.basic_publish(exchange='eml',
                            routing_key='mail',
                            body=json.dumps(email),
                            properties=pika.BasicProperties(
                                delivery_mode = pika.spec.PERSISTENT_DELIVERY_MODE
                            ))
        print(f" [x] Sent {email['subject']} (to {email['to']})")
    print(f" Gee, I sent all {amount} ")

if(ERROR_TEST):
    #ERROR 1: no template
    email = generate_fake_payload(template="notexisting", subj="will never be delivered")
    channel.basic_publish(exchange='eml',
                        routing_key='mail',
                        body=json.dumps(email),
                        properties=pika.BasicProperties(
                            delivery_mode = pika.spec.PERSISTENT_DELIVERY_MODE
                        ))
    print(f" [x] Sent {email['subject']} (to {email['to']})")
    #ERROR 2: missing field
    email = generate_fake_payload(return_malformed_mail=True, subj="will never be delivered")
    channel.basic_publish(exchange='eml',
                        routing_key='mail',
                        body=json.dumps(email),
                        properties=pika.BasicProperties(
                            delivery_mode = pika.spec.PERSISTENT_DELIVERY_MODE
                        ))
    print(f" [x] Sent {email['subject']} (to {email['to']})")

if(ALL_TEMPLATES_TEST):
    templates_tested=0
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
            templates_tested+=1
    file_count = len([f for f in os.listdir("../templates/") if os.path.isfile(os.path.join("../templates/", f))])
    if(file_count != templates_tested):
        print()
        print()
        print(f"Tested {templates_tested} templates but the folder contains {file_count}")

connection.close()
