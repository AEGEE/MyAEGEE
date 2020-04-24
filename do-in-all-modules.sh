#!/bin/bash
#UTILITY script. To be run on the host/wherever the repos are

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# shellcheck disable=SC2046
export $(grep -v '^#' "${DIR}/.env" | xargs -d '\n')

service_string=$(printenv ENABLED_SERVICES)
# shellcheck disable=SC2206
services=( ${service_string//:/ } )

for s in "${services[@]}"; do
    cd "${DIR}/${s}/docker/" || exit 1
    # for file in "$(ls dock*.yml)"; do
    #     #example command:
    #     #sed -i 's/version: "2.4"/version: "3.4"/' ${file}
    #     echo "hello"
    # done
done
