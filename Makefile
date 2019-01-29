  
default:  
	echo 'Most common options are bootstrap, start, monitor, live_refresh, restart, nuke_dev, clean (cleans untagged/unnamed images)'

bump:
	./helper.sh --bump

init: #check recursive & make secrets, change pw, change .env file
	./helper.sh -v --init

build: #docker-compose build
	./helper.sh -v --build

start: #docker-compose up -d
	./helper.sh --start
  
bootstrap: init build start

monitor: #by default it logs everything, to log some containers only, use the script by hand
	./helper.sh --monitor

refresh:  build
  
live_refresh:  # docker-compose up -d --build (CD TARGET)
	./helper.sh --refresh
  
# stop: # docker-compose stop
# 	./helper.sh --stop
  
# down: # docker-compose down
# 	./helper.sh --down

restart: 
 	./helper.sh --down

hard_restart: nuke_dev restart

nuke_dev:   #docker-compose down -v #TODO if needed: make this nuke take into account the .env like in deploy
	./helper.sh --nuke
  
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
