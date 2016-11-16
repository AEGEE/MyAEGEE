#!/bin/bash

cp  /root/configFile.json /usr/app/oms-events/lib/config/configFile.json

# wait until supervisor has restarted the service
sleep 0.5
printf 'Config updated, waiting for service to restart'
n=0
until [ $n -ge 15 ]
do
	curl --output /dev/null --silent --fail http://localhost:8082/ping && break
	n=$[$n+1]
	sleep 1
	printf '.'
done
printf '\n'

# Set up the api-key in the configuration file.
curl localhost:8082/registerMicroservice