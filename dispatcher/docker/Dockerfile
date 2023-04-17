FROM python:3.10-slim

WORKDIR /usr/app/src

COPY ./dispatcher/main.py /usr/app/src/main.py
COPY ./templates /usr/app/templates
COPY ./requirements.txt /usr/app/src/requirements.txt

#USER python

#ENV NPM_CONFIG_PREFIX=/home/node/.npm-global
#ENV PATH="/home/node/.npm-global/bin:${PATH}"

RUN pip install --no-cache-dir -r requirements.txt

ENTRYPOINT [ "python" ]
CMD ["main.py"]
