"""main(): the RabbitMQ topology the dispatcher declares and consumes."""

import main


class FakeBlockingChannel:
    def __init__(self):
        self.calls = []

    def exchange_declare(self, **kwargs):
        self.calls.append(("exchange_declare", kwargs))

    def queue_declare(self, **kwargs):
        self.calls.append(("queue_declare", kwargs))

    def queue_bind(self, **kwargs):
        self.calls.append(("queue_bind", kwargs))

    def basic_consume(self, **kwargs):
        self.calls.append(("basic_consume", kwargs))

    def start_consuming(self):
        self.calls.append(("start_consuming", {}))


class FakeConnection:
    instances = []

    def __init__(self, parameters):
        self.parameters = parameters
        self.channel_object = FakeBlockingChannel()
        FakeConnection.instances.append(self)

    def channel(self):
        return self.channel_object


def run_main(monkeypatch, env=None):
    FakeConnection.instances = []
    for key in ("RABBITMQ_HOST", "RABBITMQ_USER", "RABBITMQ_PASS", "ENV", "EMAIL_ADDRESS"):
        monkeypatch.delenv(key, raising=False)
    for key, value in (env or {}).items():
        monkeypatch.setenv(key, value)
    connects = []
    monkeypatch.setattr(main.pika, "BlockingConnection", FakeConnection)
    monkeypatch.setattr(main, "connect_to_smtp", lambda: connects.append(True))
    monkeypatch.setattr(main, "smtpObj", None)

    main.main()

    [connection] = FakeConnection.instances
    return connection, connects


def calls_of(channel, name):
    return [kwargs for call, kwargs in channel.calls if call == name]


def test_main_connects_with_the_configured_credentials_and_a_heartbeat(monkeypatch):
    connection, connects = run_main(monkeypatch, {
        "RABBITMQ_HOST": "queue.example.org", "RABBITMQ_USER": "dispatcher", "RABBITMQ_PASS": "secret",
        "ENV": "production", "EMAIL_ADDRESS": "mailer@example.org",
    })

    parameters = connection.parameters
    assert parameters.host == "queue.example.org"
    assert parameters.credentials.username == "dispatcher"
    assert parameters.credentials.password == "secret"
    assert parameters.heartbeat == 600
    assert main.env == "production"
    assert main.EMAIL_ADDRESS == "mailer@example.org"
    assert connects == [True]
    assert connection.channel_object.calls[-1][0] == "start_consuming"


def test_main_defaults_to_the_development_broker(monkeypatch):
    connection, _ = run_main(monkeypatch)

    assert connection.parameters.host == "rabbit"
    assert connection.parameters.credentials.username == "guest"
    assert main.env == "development"


def test_main_declares_the_queues_and_their_dead_letter_routes(monkeypatch):
    connection, _ = run_main(monkeypatch)
    channel = connection.channel_object

    assert calls_of(channel, "exchange_declare") == [
        {"exchange": "eml", "exchange_type": "direct", "durable": True},
        {"exchange": "dead_letter_exchange", "exchange_type": "direct", "durable": True},
    ]
    queues = {call["queue"]: call for call in calls_of(channel, "queue_declare")}
    assert queues["email"]["arguments"]["x-dead-letter-exchange"] == "dead_letter_exchange"
    assert queues["email"]["arguments"]["x-dead-letter-routing-key"] == "dead_letter_routing_key"
    assert queues["error_queue"] == {"queue": "error_queue", "durable": True}
    for name, ttl in main.RETRY_QUEUES:
        assert queues[name] == {"queue": name, "durable": True, "arguments": {
            "x-message-ttl": ttl, "x-dead-letter-exchange": "eml", "x-dead-letter-routing-key": "mail",
        }}
    assert calls_of(channel, "queue_bind") == [
        {"exchange": "eml", "queue": "email", "routing_key": "mail"},
        {"exchange": "dead_letter_exchange", "queue": "error_queue", "routing_key": "dead_letter_routing_key"},
    ]


def test_main_consumes_the_email_and_the_error_queue_with_manual_acks(monkeypatch):
    connection, _ = run_main(monkeypatch)

    assert calls_of(connection.channel_object, "basic_consume") == [
        {"queue": "email", "auto_ack": False, "on_message_callback": main.send_email},
        {"queue": "error_queue", "auto_ack": False, "on_message_callback": main.process_dead_letter_messages},
    ]
    assert main.channel is connection.channel_object
    assert main.tpl_environment.get_template("custom.jinja2")
