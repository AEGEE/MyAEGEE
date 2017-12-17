  
default:  
	echo 'Options are bootstrap, start, monitor, stop, restart, nuke, clean (cleans untagged/unnamed images)'

start:  
	sudo ./oms.sh up -d
  
bootstrap: start monitor

monitor:
	sudo ./oms.sh logs -f omscore && sudo ./oms.sh logs -f omsevents-bootstrap

refresh:  
	sudo ./oms.sh build
  
live-refresh:  
	sudo ./oms.sh up --build
  
stop:  
	sudo ./oms.sh down
  
restart: stop bootstrap

nuke:  
	sudo ./oms.sh down -v
  
#clean:
#	sudo docker rmi $(docker images -qf "dangling=true")
###How to remove all containers:
#  docker rm $(docker ps -aq)
###How to kill/stop and remove all containers:
#  docker rm $(docker {kill|stop} $(docker ps -aq))
###How to remove all dangling images:
#  docker rmi $(docker images -qf "dangling=true")
###How to remove all images:
#  docker rmi $(docker images -q)
