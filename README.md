#AEGEE-Europe's Online Membership System
## OMS-docker

## Description
The provisional repository for the Online Management System (OMS), an open-source project of student association AEGEE-Europe.

It makes use of docker, and docker-compose.

[Read more about it.](https://oms-project.atlassian.net/wiki/spaces/GENERAL/overview)

## Installing

[Install docker and docker-compose](https://docs.docker.com/compose/install/)

Install OMS:
```
git clone --recursive https://github.com/AEGEE/oms-docker.git
cd oms-docker/docker
sudo docker-compose up
```

*This is assuming you are running a Linux installation, for other operating systems virtualization is recommended.*

[**More information on the installation**](https://oms-project.atlassian.net/wiki/spaces/GENERAL/pages/17235970/Installation)

## Usage
After running the system, you can navigate to it in your web browser: http://localhost

For more detailed usage guides, see the repository of the containers.

## Contribute
[You can read more about contributing on our confluence.](https://oms-project.atlassian.net/wiki/spaces/GENERAL/overview)

## License
Apache License 2.0, see LICENSE.txt for more information.
