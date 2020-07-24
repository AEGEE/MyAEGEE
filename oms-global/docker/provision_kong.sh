#!/bin/bash

set -e

# To run this script:
#  1 cd into the root folder
#  2 ./oms-global/docker/provision_kong.sh
# Assumption: this script is run from the vagrant machine

#migrations: the first time kong will go down because of missing
# configuration. Launch this
./helper.sh --docker -- run kong kong migrations bootstrap

#starting kong again
make start

sleep 5

### Create service for a debugging purpose
curl -i -X POST \
  --url http://localhost:8001/services/ \
  --data 'name=debugger' \
  --data 'url=http://mockbin.org/request'

### Create route of the service above
curl -i -X POST \
  --url http://localhost:8001/services/debugger/routes \
  --data 'paths[]=/mock'

### CORE svc
curl -i -X POST \
  --url http://localhost:8001/services/ \
  --data 'name=core' \
  --data 'url=http://core:8084'

### CORE svc route
curl -i -X POST \
  --url http://localhost:8001/services/core/routes \
  --data 'paths[]=/core'
  #--data 'hosts[]=example.org'

sleep 1
### try it
curl -i -X GET \
  --url http://localhost:8000/core/healthcheck
  #--url http://localhost:8000/ \
  #--header 'Host: example.com'

### EVENTS svc
curl -i -X POST \
  --url http://localhost:8001/services/ \
  --data 'name=events' \
  --data 'url=http://events:8084'

### EVENTS svc route
curl -i -X POST \
  --url http://localhost:8001/services/events/routes \
  --data 'paths[]=/events'


### STATUTORY svc
curl -i -X POST \
  --url http://localhost:8001/services/ \
  --data 'name=statutory' \
  --data 'url=http://statutory:8084'

### STATUTORY svc route
curl -i -X POST \
  --url http://localhost:8001/services/statutory/routes \
  --data 'paths[]=/statutory'


### DISCOUNTS svc
curl -i -X POST \
  --url http://localhost:8001/services/ \
  --data 'name=discounts' \
  --data 'url=http://discounts:8084'

### DISCOUNTS svc route
curl -i -X POST \
  --url http://localhost:8001/services/discounts/routes \
  --data 'paths[]=/discounts'


### MAILER svc
curl -i -X POST \
  --url http://localhost:8001/services/ \
  --data 'name=mailer' \
  --data 'url=http://mailer:4000'

### MAILER svc route
curl -i -X POST \
  --url http://localhost:8001/services/mailer/routes \
  --data 'paths[]=/mailer'

### gsuite-wrapper svc
curl -i -X POST \
  --url http://localhost:8001/services/ \
  --data 'name=gsuite-wrapper' \
  --data 'url=http://gsuite-wrapper:8084'

### gsuite-wrapper svc route
curl -i -X POST \
  --url http://localhost:8001/services/gsuite-wrapper/routes \
  --data 'paths[]=/gsuite-wrapper'
# One can also add authentication, but it is left for later
