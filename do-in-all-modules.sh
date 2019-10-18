#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
export $(cat $DIR/.env | grep -v ^# | xargs)

service_string=$(printenv ENABLED_SERVICES)
services=(${service_string//:/ })

for s in "${services[@]}"; do
    cd ${DIR}/${s}/docker/
    for file in "$(ls dock*.yml)"; do
        #example command:
        #sed -i 's/version: "2.4"/version: "3.4"/' ${file}
        echo "hello"
    done
done
