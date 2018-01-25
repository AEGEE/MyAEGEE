# AEGEE-Europe's Online Membership System
## OMS-docker

## Description
The repository for the [Online Membership System (OMS)](https://github.com/AEGEE/oms-docker), an open-source project of the student/youth association [AEGEE-Europe](http://aegee.org/).

It makes use of docker, and docker-compose.

[Read more about it and docker requirements](https://oms-project.atlassian.net/wiki/spaces/GENERAL/overview)

## Installing

[Install docker and docker-compose](https://docs.docker.com/compose/install/) (make sure you install the correct versions)

Install the web application:
```
git clone --recursive https://github.com/AEGEE/oms-docker.git
cd oms-docker
./oms.sh up 
```

*This is assuming you are running a Linux installation, for other operating systems virtualization is recommended.*

If you have a non-Linux installation, then the commands are as following (assuming you have Virtualbox and Vagrant installed as per the link below the commands)

```
git clone --recursive https://github.com/AEGEE/oms-docker.git
cd oms-docker
vagrant up 
```

[**More information on the installation**](https://oms-project.atlassian.net/wiki/spaces/GENERAL/pages/17235970/Installation)

## Usage
After running the system, you can navigate to it in your web browser. The URLs differ based on how you run it; however no matter how you decide to run it, _it is suggested_ to edit the `/etc/hosts` file to add the entry: `192.168.168.168 appserver traefik.appserver portainer.appserver`, to be able to use advanced features.

For using it, it becomes:

|Case|URL|
|---|---|
|Pure docker| http://localhost |
|Vagrant| http://localhost:8888 |
| Vagrant, applying the advice above| http://appserver, with the possibility of going to http://portainer.appserver or http://traefik.appserver |


[For more detailed usage guides see this usage tips page.](https://oms-project.atlassian.net/wiki/spaces/GENERAL/pages/23655986/Usage+tips)
For container-specific usage guides see the container's repository.

## Contribute
[You can read more about contributing on our confluence.](https://oms-project.atlassian.net/wiki/spaces/GENERAL/overview)

## Issue tracker
[We use JIRA as our preferred issue tracker.](https://oms-project.atlassian.net/projects/GENERAL/issues)

## Licence
Apache License 2.0, see LICENSE.txt for more information.

## Ports registered on traefik
| Port | What | Container |
|---|---|---|
| 80,443 | standard entrypoint | traefik |
| 5432 | not registered | postgres |

## Deployment script
The types of deployment:
-local (docker/vagrant), with default silly Passwords
-local (docker/vagrant), with hardened passwords
-remote, with a zero-downtime upgrade
-remote, with a complete wipe (major overhauls)

a script is provided for you (deploy.sh), in which you can specify the target (deploy.sh --target=local)

### TESTS to perform for the deploy script
OK fresh install (problema di permission denied per modificare .env -solved with sudo)
- refresh
- nuke (problema di permission denied per rimuovere node modules e vendor php -solved with sudo) 
- through provision script


- base docker compose is needed because it is the "base" to get the relative path of all the future docker compose files
