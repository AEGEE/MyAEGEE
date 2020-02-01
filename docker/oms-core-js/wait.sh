#!/bin/bash

echo "Waiting for bootstrap"

while ! nc -z localhost 8084; do
  sleep 0.1
done

echo "Bootstrap finished"

