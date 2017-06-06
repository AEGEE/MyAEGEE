  
default:  
	echo 'Options are bootstrap, start, monitor, stop, restart, nuke, clean (cleans untagged/unnamed images)'

start:  
	export COMPOSE_PROJECT_NAME=myaegee && sudo docker-compose up -d
  
bootstrap: start monitor

monitor:
	sudo docker-compose logs -f omscore-bootstrap && sudo docker-compose logs -f omsevents-bootstrap

stop:  
	sudo docker-compose down
  
restart: stop bootstrap

nuke:  
	sudo docker-compose down -v
  
clean:
	sudo docker rmi $(docker images -qf "dangling=true")
###How to remove all containers:
#  docker rm $(docker ps -aq)
###How to kill/stop and remove all containers:
#  docker rm $(docker {kill|stop} $(docker ps -aq))
###How to remove all dangling images:
#  docker rmi $(docker images -qf "dangling=true")
###How to remove all images:
#  docker rmi $(docker images -q)
