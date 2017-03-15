#!/bin/bash

pkill oms-tunnel

until /usr/src/oms-tunnel/oms-tunnel; do
    echo "App crashed with exit code $?.  Respawning.." >&2
    sleep 1
done