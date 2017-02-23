#!/bin/bash

if [ -f "/usr/scripts/strapstate/omsevents" ]
then
	echo "Bootstrap-file found, not executing bootstrap script"
else
	echo "Waiting for omscore to finish bootstrapping"
	while [ ! -f "/usr/scripts/strapstate/omscore" ]
	do
	 	sleep 2
	done

	echo "Starting bootstrap for oms-events"

	cp  /usr/scripts/configFile.json /usr/app/oms-events/lib/config/configFile.json

	cd /usr/app/oms-events
	npm install

	# Allow the omsevents container to start
	touch /usr/scripts/strapstate/omsevents-basic

	echo "Waíting for omsevents to start up"
	until $(curl --output /dev/null --silent --fail http://omsevents:8082/ping); 
	do
	    printf '.'
	    sleep 1
	done

	echo "oms-events up"
	# Trigger the registering procedure
	curl -sS http://omsevents:8082/registerMicroservice

	touch /usr/scripts/strapstate/omsevents
	echo "Bootstrap finished"
fi
