"""requeue_wait and the dead-letter queue: messages that wait for another try."""

import main
import pytest
from conftest import Method, Properties

QUEUES = ["wait_5min", "wait_50min", "wait_5h", "wait_50h", "wait_100h"]


def test_the_retry_queues_get_longer():
    assert main.RETRY_QUEUE_NAMES == QUEUES
    ttls = [ttl for _, ttl in main.RETRY_QUEUES]
    assert ttls == sorted(ttls)
    assert ttls[0] == 5 * 60_000


@pytest.mark.parametrize("headers,expected_index", [(None, 0), ({}, 0), ({"x-retry-index": 0}, 1), ({"x-retry-index": "2"}, 3)])
def test_a_message_goes_to_the_next_retry_queue(fake_channel, alerts, headers, expected_index):
    main.requeue_wait(fake_channel, Method(7), Properties(headers), b"{}", reason="template_not_found-x")

    assert fake_channel.acks == [7]
    assert fake_channel.published == [{
        "exchange": "",
        "routing_key": QUEUES[expected_index],
        "body": b"{}",
        "headers": {"reason": "template_not_found-x", "x-retry-index": expected_index},
        "delivery_mode": 2,
    }]
    assert alerts[0][0] == "A template is missing! (template_not_found-x)"
    assert f"Retry attempt {expected_index + 1}/5" in alerts[0][1]
    assert main.ONCALL_HANDLER not in alerts[0][1]


def test_the_last_try_alerts_the_person_on_call(fake_channel, alerts):
    main.requeue_wait(fake_channel, Method(), Properties({"x-retry-index": 3}), b"{}", reason="r")

    assert fake_channel.published[0]["routing_key"] == "wait_100h"
    assert "LAST ATTEMPT TO FIX" in alerts[0][1]
    assert main.ONCALL_HANDLER in alerts[0][1]


def test_a_message_is_dropped_after_the_last_retry_queue(fake_channel, alerts):
    main.requeue_wait(fake_channel, Method(3), Properties({"x-retry-index": 4}), b"{}", reason="smtp_unavailable")

    assert fake_channel.published == []
    assert fake_channel.acks == [3]
    assert alerts == [("Time over, a message was dropped (smtp_unavailable)", ":poop:")]


def test_a_dead_letter_waits_in_the_last_retry_queue(fake_channel, alerts):
    main.process_dead_letter_messages(fake_channel, Method(9), Properties(), b'{"to": "x"}')

    assert fake_channel.published == [{
        "exchange": "",
        "routing_key": "wait_100h",
        "body": b'{"to": "x"}',
        "headers": {"x-retry-index": 4},
        "delivery_mode": 2,
    }]
    assert fake_channel.acks == [9]
    assert len(alerts) == 1
