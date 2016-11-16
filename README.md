# Description
This is a dev environment based on docker, as an alternative to the homestead virtualization which already exists. As docker is not yet too mature on OSX and Windows, I'd recommend using this one only if you are natively working on linux and/or a huge dockerfan.

# Installing
This script depends on git, docker and docker-compose, check your dirstibutions manual how to install them. Then cd to a folder where you want to put this project into.

```
git clone --recursive https://github.com/AEGEE/oms-docker.git
cd oms-docker/docker
docker-compose up -d
docker-compose exec omscore bash /root/bootstrap.sh
```
If everything went well, open you browser on `http://localhost` and login with the default credentials. Navigate to the modules tab and get the API Key in there, copy and paste it into `oms-docker/docker/api-key`. Soon this will work automatically
```
docker-compose exec omsevents bash /root/bootstrap.sh
```

Et voila, you should have a working dev environment set up. You will still need to activate the events module in the modules tab where you already copied the API Key.

Now some optional steps could follow. However, most likely you will not need them
* Set another postgres password in `oms-docker/docker/workspace/.env` and `oms-docker/docker/docker-compose.yml (section postgres)`
* If you want to reach the website somewhat different than over localhost, modify the URL in `oms-docker/docker/omscore/.env` and `oms-docker/docker/omsevents/configFile.json`


# Usage
To stop everything, run `docker-compose down` in the docker-folder. You can start everything again with `docker-compose up -d` Other than that, you should have a working dev-environment by now. If something breaks during development, you can try rebuilding everything with `docker-compose build`. Maybe also calling the bootstrap scripts again could help, but in theory they should only be needed upon creation.

With `docker ps` you can see which containers are currently running. If you want to "log into" the omscore, you can run `docker-compose exec omscore bash`. For omsevents run `docker-compose exec omsevents bash`

# Credits
This repo was loosely based upon laradock, the docker-alternative to the native homestead.