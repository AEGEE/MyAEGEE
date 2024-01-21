#!/bin/bash

ALMOST_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DIR="${ALMOST_DIR}/.."
export $(grep -v '^#' "${DIR}/.env" | xargs -d '\n')

summary_images ()
{
    service_string=$(printenv ENABLED_SERVICES)
    own_services=( "frontend" "core" "events" "statutory" )
    # shellcheck disable=SC2206
    services=( ${service_string//:/ } )
    for s in "${services[@]}"; do
      if [[ " ${own_services[@]} " =~ " ${s} " ]]; then
        if [[ -f "${DIR}/${s}/docker/Dockerfile" ]]; then
            echo "${s}: $(head -n2 "${DIR}/${s}/docker/Dockerfile")"
        else
            echo "${s}: $(head -n2 "${DIR}/${s}/docker/${s}/Dockerfile")"
        fi
      fi
    done
}

# Function to generate the table rows
function generate_row {
    local name="$1"
    local value="$2"
    printf "| %-15s | %-15s |\n" "$name" "$value"
}

# Start of the table
echo "+-----------------+-----------------+"
generate_row "Docker version" "$(docker --version | awk '{print $3}')"
# generate_row "Docker server" "$(docker version -f json | jq .Server.Version)"
# generate_row "Docker client" "$(docker version -f json | jq .Client.Version)"
generate_row "Docker compose" "$(docker-compose --version | awk '{print $3}')"
generate_row "Node" "$(node -v)"
generate_row "NPM" "$(npm -v)"
generate_row "Python" "$(python3 --version | sed 's/Python //' 2>&1)"
echo "+-----------------+-----------------+"

echo
echo
echo "Images version:"
summary_images
