#!/bin/bash
#THIS IS RUN ON THE GUEST MACHINE
# By Vagrant

#usage: provision.sh will call deploy.sh (but it is safer to deploy manually! so this is just for when I have a brand new server and want to bootstrap it from remote) which will update the git repo on the host, call a password setter, and run it

#which server (URL) we want to deploy to (fraktis, amazon, digitalocean, azure)
REMOTE_HOST=fraktis.aegee.org
REMOTE_PORT=22302
REMOTE_USER=
#a private key to auth passwordless to this server
REMOTE_HOST_KEY_PATH=~/.ssh/id_rsa
#the path we want to deploy the application to
DEPLOY_PATH=/opt/MyAEGEE

#TODO: copy deploy.sh on a remote machine and call it, it will do everything by itself

#IF REMOTE
scp -i $(REMOTE_HOST_KEY_PATH) -p $(REMOTE_PORT) $(REMOTE_USER)@$(REMOTE_HOST) $(DEPLOY_PATH)/deploy.sh

ssh -i $(REMOTE_HOST_KEY_PATH) -p $(REMOTE_PORT) $(REMOTE_USER)@$(REMOTE_HOST):$(DEPLOY_PATH) ./deploy.sh

#IF LOCAL
