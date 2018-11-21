# AEGEE-Europe's Online Membership System
## OMS-docker

## Description
The repository for the [Online Membership System (OMS)](https://github.com/AEGEE/oms-docker), an open-source project of the student/youth association [AEGEE-Europe](http://aegee.org/).

It makes use of docker, and docker-compose.

[Read more about it and docker requirements](https://oms-project.atlassian.net/wiki/spaces/GENERAL/overview)

## Installing

Pre-requisites: install [Virtualbox](https://www.virtualbox.org/wiki/Downloads) first, then [Vagrant](https://www.vagrantup.com/downloads.html). Even if you have a linux box, this is *very* recommended.
If you decide to not do it, sigh... but don't come to cry to us. [Install docker and docker-compose](https://docs.docker.com/compose/install/) (make sure you install the correct versions)

Install the web application:
```
git clone --recursive https://github.com/AEGEE/oms-docker.git
cd oms-docker
./start.sh 
```

If you have a non-Linux installation, then the commands are as following (assuming you have Virtualbox and Vagrant installed, as per above)

```
git clone --recursive https://github.com/AEGEE/oms-docker.git
cd oms-docker
vagrant up 
```
**It will take a while**, so grab a cup of some hot beverage.

For windows users: since windows is retarded, you have to right-click "run_as_win_administrator.bat" and click "run as administrator". It will tell you the line to copy (on another terminal that will open) and open the file you need to edit in notepad. Paste the content (it is also written down in the next section) at the last line of the file, save, and exit. Then you can go make tea. 

[**More information on the installation**](https://oms-project.atlassian.net/wiki/spaces/GENERAL/pages/17235970/Installation)

## Usage
After running the system, you can navigate to it in your web browser. The URLs differ based on how you run it; however no matter how you decide to run it, _it is suggested_ to edit the `/etc/hosts` file (on windows: `C:\Windows\system32\drivers\etc\hosts`) to add the entry: `192.168.168.168 my.appserver traefik.appserver portainer.appserver kibana.appserver`, to be able to use advanced features.

For using it, it becomes:

| Case | URL |
|---|---|
| Pure docker | http://localhost |
| Vagrant | http://localhost:8888 |
| Vagrant, applying the advice above| http://my.appserver, with the possibility of going to http://portainer.appserver or http://traefik.appserver |

### Subdomains registered on traefik
read "_subdomain_.appserver"; e.g. you put in your browser traefik.appserver

|Subdomain|What|Container|
|---|---|---|
| traefik | Traefik's statuspage (under login) | traefik |
| kibana | Central logging (under login) | kibana |
| portainer | Easier container mgmt | portainer |
| status | MyAEGEE's statuspage | cachet |
| my | MyAEGEE | oms-frontend |
| www | Website | wordpress |

[For more detailed usage guides see this usage tips page.](https://oms-project.atlassian.net/wiki/spaces/GENERAL/pages/23655986/Usage+tips)
For container-specific usage guides see the container's repository.

## Easy script
There is a file called Makefile that gives some easy shortcut to do stuff. Invoke it in the following way:

| Command | What |
|---|---|
| make init | (Run only the first time by vagrant) | 
| make build | Build the containers registered in the .env file | 
| make start | Runs the containers registered in the .env file | 
| make bootstrap | (init, build, start) in this order | 
| make monitor | If you didn't install kibana, then you may want to have a look at the logs through this | 
| make live-refresh | Updates the containers to the new version (if any) and restarts them | 
| make stop/restart/hard-restart | Just don't use them on the server, EVER | 
| make bump | Only for development, updates the submodules |

For now, if one wants to follow some specific logs, they have to invoke helper.sh manually e.g. 
```
./helper.sh --monitor container1 container2...containerN
```

Likewise, for now if one wants to execute a command on a container they have to invoke helper.sh manually e.g. 
```
./helper.sh --execute containername command
```

On first run of vagrant, the bootstrap target will be invoked

## Contribute
[You can read more about contributing on our confluence.](https://oms-project.atlassian.net/wiki/spaces/GENERAL/overview)

## Issue tracker
[We use JIRA as our preferred issue tracker.](https://oms-project.atlassian.net/projects/MEMB/issues)

## Licence
Apache License 2.0, see LICENSE.txt for more information.


## Deployment script
The types of deployment:

-local (docker/vagrant), with default silly Passwords

-local (docker/vagrant), with hardened passwords

