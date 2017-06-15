#!/bin/bash

#better safe than sorry - I still have to read about permissions for volumes
# in overlay-fs
chown -R laradock:laradock /var/www  && chown -R laradock:laradock /var/shared/core

if [ -f "/var/strapstate/omscore" ]
then
	echo "Bootstrap-file found, not executing bootstrap script"
else
	echo "Bootstrapping..."
  sleep 15 #give time to postgres container to startup
  su laradock -c 'cp /var/shared/core/.env /var/www/.env'
	cd /var/www
  su laradock -c 'composer install || { echo "Error at composer install"; exit 10; }'
	php artisan config:cache || { echo "Error at config:cache"; exit 11; }
	php artisan migrate      || { echo "Error at migrate"; exit 12; }
	php artisan key:generate || { echo "Error at key:generate"; exit 13; }
	php artisan config:cache || { echo "Error at config:cache (2)"; exit 14; }
	php artisan db:seed      || { echo "Error at db:seed"; exit 15; }
	php artisan config:cache || { echo "Error at config:cache (3)"; exit 16; }

	npm install

	mkdir -p storage

	# Create a file on strapstate to indicate we do not need to run this again
	touch /var/strapstate/omscore

	echo "Bootstrap finished"
fi
