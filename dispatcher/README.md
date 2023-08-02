# Dispatcher

Polls rabbitMQ and takes action (sends mail).

## How to run it
### Pre-requisites
In the Vagrant's appserver VM, the packages are installed globally:
1. faker
1. jinja2
1. pika

Otherwise use poetry to install dependencies and launch the virtual environment.

### Launching it and testing it
In a console, run `python3 dispatcher/main.py`.
In another console, run `python3 helpers/send.py`.
Control on `appserver.test:8025` the emails sent. It is also possible to control rabbit's stats on `appserver.test:8080`

This method is now dockerised. Using the docker way is useful for the 'DNS' feature of docker (i.e. not hardcoding the IP address of the rabbit host)

### Rationale
We do not need a web service for this, only a worker. Doing it this way only means it cannot be scaled (unless precautions are taken for the ack of the message, but pika should already give this out of the box).
In order to add templates, one can work on the filesystem: as the template file is read from memory at the time a message is received, there is basically a mechanism of hot-reload ready to be used.

We do not need a web service, because we do not need to pilot anything.

## Queues

Current queues:
1. email

Queues envisioned:
1. email
1. telegram
1. slack (If EBs have enabled it)
1. webgui (handled by vue, NOT by this program)

## TODOs and next steps
rather in order:

1. [x] (not on this project): run core with the email as 'inserting in the queue' instead of 'API request to mailer'
1. [?] (not on this project): run core with the email as 'exchange' instead of 'inserting in the queue'
1. [x] include traefik configuration to have the mailhog and rabbit on a subdomain instead of `domain:port`
1. [x] When RabbitMQ quits or crashes it will forget the queues and messages unless you tell it not to: we need to mark both the queue and messages as durable
1. [ ] Add auto-retry (DLQ). rabbit is smart and doesn't let me process a message again unless i force it.. https://devcorner.digitalpress.blog/rabbitmq-retries-the-new-full-story/
1. [ ] add the telegram queue
1. investigate the massmailer queue: a queue which picks every message, and creates a list of "bcc" to send only one email? (danger: queue needs something like batch ack..) - OR it is not feasible at all because "mass"mailer is still "personalised" mailer?

1. why do we even have a `<`title`>` (which is dynamic), why not using directly the subject? (re: the body of the email)
1. remove extension Jinja2 (into jinja)
1. make it such that templates list is read from fs (for dynamic tests)



https://www.rabbitmq.com/publishers.html#unroutable


Each consumer (subscription) has an identifier called a consumer tag. It can be used to unsubscribe from messages. Consumer tags are just strings.
