# AEGEE-Europe's Online Membership System
## `MyAEGEE`

## Description
The repository for the ["Online Membership System" (OMS)](https://github.com/AEGEE/MyAEGEE), an open-source project of the student/youth association [AEGEE-Europe](http://aegee.org/).

It makes use of docker, and docker-compose.

[Read more about the project](https://myaegee.atlassian.net/wiki/spaces/GENERAL/overview)

# Installation

Explanation of the installation are here. Explanation of why we're doing it this way is [at the bottom](#Under-the-hood)

## Pre-requisites: installations required
install [Virtualbox](https://www.virtualbox.org/wiki/Downloads) first, then [Vagrant](https://www.vagrantup.com/downloads.html). Even if you have a linux box, this is **very** recommended.
If you decide to not do it, *sigh...* but don't come to cry to us.

If you decide you know better than us, [install docker and docker-compose](https://docs.docker.com/compose/install/) on your Windows/Linux/Mac machine, instead of Virtualbox and Vagrant. (Make sure you install the correct versions: tested with Docker CE 19.03.1 and docker-compose 1.24.1)

Note: if you use Vagrant, Docker will be already automatically on the virtual machine.

Memory requirements for the VM bootstrapped with Vagrant: 2GB (i.e. you need a machine with at least 3GB physical RAM)

## Pre-requisites: URL mapping

You are encouraged to edit the `/etc/hosts` file (on windows: `C:\Windows\system32\drivers\etc\hosts`) to add the entry:

Pure docker case: `127.0.0.1 appserver.test my.appserver.test traefik.appserver.test portainer.appserver.test kibana.appserver.test`

Vagrant case: `192.168.168.168 appserver.test my.appserver.test traefik.appserver.test portainer.appserver.test kibana.appserver.test`

to be able to use advanced features.

In the linux case, it is handled by `start.sh`.
As a helper in the windows case, you have the script "run_as_win_administrator.bat". You have to right-click it and click "run as administrator". It will tell you the line to copy (on another terminal that will open) and open the file you need to edit in notepad. Paste the content at the last line of the file, save, and exit.

Now you can install the system

### Install the web application (linux):

```
git clone --recursive https://github.com/AEGEE/MyAEGEE.git
cd MyAEGEE
./start.sh
```

### Install the web application (non-linux):

```
git clone --recursive https://github.com/AEGEE/MyAEGEE.git
cd MyAEGEE
vagrant up
```

## Configuration file
Everything related to the behaviour of the app is defined in the top-most `.env` file. Most important parameters are:

`ENABLED_SERVICES`: telling which parts of the system are enabled

`MYAEGEE_ENV`: telling in which mode the system is run

`<servicename>_SUBDOMAIN`: telling how to access a specific service

See [below](#moving-parts) for more info.

# Usage

## Accessing it
After launching the system, you can navigate to it in your web browser. The URLs differ based on how you run it.

For accessing it, it becomes:

| Case | URL |
|---|---|
| Pure docker | http://my.appserver.test, with the possibility of going to http://portainer.appserver.test or http://traefik.appserver.test |
| Vagrant | http://my.appserver.test, with the possibility of going to http://portainer.appserver.test or http://traefik.appserver.test |

### Subdomains registered on traefik
read "_subdomain_.appserver.test"; e.g. you put in your browser `http://traefik.appserver.test`

|Subdomain|What|Container|
|---|---|---|
| my | MyAEGEE | frontend |
| portainer | Easier container mgmt (development only) | portainer |
| traefik | Traefik's dashboard (under login) | traefik |
| kibana | Central logging (under login) [WIP] | kibana |
| www | Website | wordpress |
| wiki | AEGEE's Wiki, the backbone of knowledge | mediawiki |

You can customise these subdomains by editing the `.env` file as explained above


FIXME?? [For more detailed usage guides see this usage tips page.](https://myaegee.atlassian.net/wiki/spaces/GENERAL/pages/23655986/Usage+tips)
For container-specific usage guides see the container's repository.

## Easy script to manipulate the installation

There is a file called `Makefile` that gives some easy shortcut to do stuff.

On first run of vagrant, the `bootstrap` target will be invoked (you don't need to do it). If you are stubborn and decide to not use Vagrant, you still don't have to invoke it (it is invoked by `start.sh`)

The general flow is that once you edit the `.env` file, `make start` should be run to update the running configuration.

You can invoke the easy scripting in the following way (this shell command must be run in the same folder of the `Makefile`):

| Command | What |
|---|---|
| make bootstrap | (`init`, `build`, `start`) in this order. (Run only the first time by vagrant/`start.sh`) |
| make init | Initialise the system (most likely you don't need to launch this) |
| make build | Build the containers registered in the .env file |
| make start | Run the containers registered in the .env file |
| make monitor | If you didn't enable kibana, then you may want to have a look at the logs through this |
| make live-refresh | Updates the containers to the new version (if any) and restarts them |
| make stop/restart/hard-restart | Just don't use them on the server, EVER |
| make bump | Only for development: updates the submodules |


### Reading the logs

For now, if one wants to follow some specific logs, they have to invoke helper.sh manually e.g.
```
./helper.sh --monitor container1 container2...containerN
```

Likewise, for now if one wants to execute a command on a container they have to invoke helper.sh manually e.g.
```
./helper.sh --execute containername command
```

## Contribute
[You can read more about contributing on our confluence.](https://myaegee.atlassian.net/wiki/spaces/GENERAL/overview)

## Issue tracker
[We use JIRA as our preferred issue tracker.](https://myaegee.atlassian.net/projects/MEMB/issues)

## Licence
Apache License 2.0, see LICENSE.txt for more information.

# Under the hood

`Virtualbox` is a utility that lets people creating virtual machines on your computer.

`Vagrant` is used as a tool to define VMs characteristics, that will be then run through Virtualbox - in other words, it is used so we can write a manifesto that defines the characteristics of a VM, and the VM generated has always the same characteristics. It is useful in this case to model the development VM just as if it was the server on which we will run the application.

`Make` is a tool that, among other things, chains commands together. So, for instance, you write in the `Makefile` that `a` runs a specific long command, `b` a different long command, and you can call the commands with `make a` or `make b`. You can also write a command `c` which is a chain of `a` followed by `b`. We use it to set a 'flow' of operations that should be followed (e.g. as explained, `make bootstrap` chains 3 operations, and one such operation is used very often i.e. `build` and/or `start`)

`start.sh` runs either `vagrant up` or `make bootstrap` (according to how you want to run your system in local) so one has to literally only launch one command and it's set to be working, after the startup time of around 10-20 minutes (according to internet connection speed)

## Individual containers

For prerequisites and installation of individual containers, see their `docker`(/`-compose`) files, located in the `(service)/docker` folder in their respective repository.

For more detailed info, we hoped to have a better knowledge base [here](https://myaegee.atlassian.net/wiki/spaces/GENERAL/pages/224231425/Microservices+information), it's not great right now but it's a something `¯\_(ツ)_/¯`

## Moving parts

### .env
The file contains variables where e.g. you define the base url (`aegee.test`) and where will various app be reachable (e.g. `my.` for `my.aegee.test` to reach the frontend).

List of defined variables:
- base url
- subdomain urls
- activated services
- runtime environment
- some default passwords
- SMTP user/pass/server for mailer
- Sendgrid user/pass
- Superadmin credentials (for other services to read; it does not set them in the system)
- folder locations

so for instance...

*Example 1*: you would use this file if you had a problem with 1 microservice and wanted to remove it from the setup. Note: the removal of the ms would not stop a container if there was one running already, so make sure you cleanup

*Example 2*: you would use this file if you wrote a new microservice and wanted to add it from the setup.

### docker-compose.yml
In the docker-compose files there are the definitions of where an app should be reached.

Docker-compose will use the variables defined above, and put them under the `labels` section of a container (if a container needs it). The `labels` section is parsed by traefik to route all the HTTP calls to the correct containers.
