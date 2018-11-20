#!/bin/bash

#modify the hosts file
sudo sh -c 'echo "192.168.168.168 appserver portainer.appserver my.appserver traefik.appserver" >> /etc/hosts'
#run vagrant
vagrant up

