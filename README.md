# Description
This is a dev environment based on Docker, as an alternative to the homestead virtualization which already exists. As Docker is not yet too mature on OSX and Windows, I'd recommend using the Vagrantfile attached which will bootstrap a VM where you will be able to use the power of Docker. This will also allow you to cluster VMs with Docker swarm.

# Installing

On all operating systems:
```
git clone --recursive https://github.com/AEGEE/oms-docker.git
vagrant up
```

If you are on linux and want an installation without Vagrant:
```
git clone --recursive https://github.com/AEGEE/oms-docker.git
cd oms-docker/docker
# If you have GNUmake (90% of chance yes)
make bootstrap
# If you have a really minimal installation
docker-compose up -d # But no rush! Wait until the bootstrap procedure has finished, check when with the following:
docker-compose logs -f omscore-bootstrap && docker-compose logs -f omsevents-bootstrap
```

NOTE: Because Traefik works reading the URL of the request, it is necessary to add to your `/etc/hosts` file a name for your address (127.0.0.1 if bare Docker, 192.168.192.168 if Vagrant) - Traefik is configured under the name **appserver**. 

Open you browser on `http://appserver` and login with the default credentials. Navigate to the modules tab and activate all the microservices


Now some optional steps could follow. However, most likely you will not need them
* Set another postgres password in `oms-docker/docker/workspace/.env` and `oms-docker/docker/docker-compose.yml (section postgres)`
* If you want to reach the website somewhat different than over localhost, modify the URL in `oms-docker/docker/omscore/.env` and `oms-docker/docker/omsevents/configFile.json`


# Usage
To do anything, just know you have to be in the host VM (accessible through `vagrant ssh` ).
Once logged in, `cd ~/oms-docker/docker` to run all the `docker-compose` commands

To stop everything, run `docker-compose down` in the folder. You can start everything again with `docker-compose up -d` Other than that, you should have a working dev-environment by now. If something breaks during development, you can try rebuilding everything with `docker-compose build`. Maybe also calling the bootstrap scripts again could help, but in theory they should only be needed upon creation.

With `docker ps` you can see which containers are currently running. If you want to "log into" the omscore, you can run `docker-compose exec omscore bash`. For omsevents run `docker-compose exec omsevents bash`

# Credits
This repo was loosely based upon laradock, the docker-alternative to the native homestead.