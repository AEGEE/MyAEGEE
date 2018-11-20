  
default:  
	echo 'Options are bootstrap, start, monitor, stop, restart, nuke, clean (cleans untagged/unnamed images)'

bump:
	./helper.sh --bump

init:
	./helper.sh -v --init #check recursive & make secrets, change pw, change .env file

build:
	./helper.sh -v --build #docker-compose build

start:  
	./helper.sh --start #docker-compose up -d
  
bootstrap: init build start

monitor:
	./helper.sh --monitor #by default it logs everything, to log some containers only, use the script by hand

refresh:  build
  
live-refresh:  
	./helper.sh --refresh # docker-compose up -d --build
  
stop:
	./helper.sh --stop # docker-compose down
  
restart: stop start

hard-restart: nuke restart

nuke:  
	sudo ./oms.sh --nuke #docker-compose down -v #TODO make this nuke take into account the .env like in deploy
  
clean_docker_dangling_images:
	docker rmi $(docker images -qf "dangling=true")

clean_docker_images:
	docker rmi $(docker images -q)

clean: clean_docker_images clean_docker_dangling_images

###How to remove all containers:
#  docker rm $(docker ps -aq)
###How to kill/stop and remove all containers:
#  docker rm $(docker {kill|stop} $(docker ps -aq))
###How to remove all dangling images:
#  docker rmi $(docker images -qf "dangling=true")
###How to remove all images:
#  docker rmi $(docker images -q)

# ARE ALL COMMANDS IDEMPOTENT???
