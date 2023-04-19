FROM python:3.10-slim

WORKDIR /usr/app/src

COPY ./requirements.txt /usr/app/src/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY ./templates /usr/app/templates
COPY ./dispatcher/main.py /usr/app/src/main.py

#USER python

#ENV FOO=BAR

ENTRYPOINT [ "python", "-u" ]
CMD ["main.py"]
