  
default:  
	echo 'Options are bootstrap, start, monitor, stop, restart, nuke'

start:  
	sudo docker-compose up -d
  
bootstrap: start monitor

monitor:
	sudo docker-compose logs -f omscore-bootstrap && sudo docker-compose logs -f omsevents-bootstrap

stop:  
	sudo docker-compose down
  
restart: stop bootstrap

nuke:  
	sudo docker-compose down -v
