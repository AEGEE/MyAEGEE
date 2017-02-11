#!/bin/bash

if [ -f "/root/strapstate/omscore" ]
then
	echo "Bootstrap-file found, not executing bootstrap script"
else
	echo "Bootstrapping..."
	cp -n /root/.env /var/www/.env
	cd /var/www
	su laradock
	
		composer install
		php artisan config:cache
		php artisan migrate
		php artisan key:generate
		php artisan config:cache
		php artisan db:seed
		php artisan config:cache

		mkdir -p storage

		# Make omscore write out the api-key
		echo "app()->call([app()->make('App\\Http\\Controllers\\ModuleController'), 'getSharedSecret'], []);" | php artisan tinker

	exit

	# Copy the key into the volume mount so other 
	mkdir -p /var/shared
	cp /var/www/storage/key /var/shared/api-key

	# Create a file on strapstate to indicate we do not need to run this again
	mkdir -p /root/strapstate
	touch /root/strapstate/omscore

	echo "Bootstrap finished"
fi