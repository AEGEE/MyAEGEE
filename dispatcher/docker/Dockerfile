FROM python:3.12-slim

WORKDIR /usr/app/src

COPY ./requirements.txt /usr/app/src/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY ./templates /usr/app/templates
COPY ./dispatcher/main.py /usr/app/src/main.py
COPY ./dispatcher/notify.py /usr/app/src/notify.py

RUN useradd -s /bin/bash python
USER python

# Checks that the RabbitMQ AMQP port is reachable from this container's network namespace.
# If rabbit becomes unavailable the container is marked unhealthy, making the degradation
# visible to Docker and any monitoring stack watching container health.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import socket; socket.create_connection(('rabbit', 5672), 3)"

ENTRYPOINT [ "python", "-u" ]
CMD ["main.py"]
