#!/bin/bash

# call it with
#   ./setup_python.sh venv
# (or just any argument) will have it installed for local dev
#   ./setup_python.sh
# will have it install the dependencies globally
# NB: The server WILL NEED globally installed

SCRIPT_DIR=$(dirname "${0}")
VENV=${1}

if [[ -z ${VENV} ]]; then # globally deps
  pip install -r "${SCRIPT_DIR}/requirements.txt"
else
  python3 -m venv myaegee-venv
  # shellcheck disable=SC1091
  source ./myaegee-venv/bin/activate
  pip install -r "${SCRIPT_DIR}/requirements.txt"
  deactivate
fi
