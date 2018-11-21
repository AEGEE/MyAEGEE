#!/bin/bash


cd /vagrant/
#possible to use flag -d
make bootstrap
#sleep 90 #to give time for the bootstrap
while [[ true ]]; do
  if [[ $(curl localhost:4000 -s | head | grep "<html>") == "<html>" ]]; then
     break;
  fi
  sleep 2;
done

