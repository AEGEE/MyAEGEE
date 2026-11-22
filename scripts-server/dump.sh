#!/bin/bash

# Usage: dump.sh [--stop] [<postgres hosts to backup>...] [-- <docker volumes to backup>...]
# The backup location is /opt/backups (override with BACKUP_DIR)
#
# Example: dump.sh postgres-core postgres-events -- myaegee_core-media myaegee_events-media
#
# Every database of a host is dumped separately with pg_dump -Fc, and the roles of the host
# with pg_dumpall --globals-only. Volumes are archived with tar. Layout of the archive:
#   <host>/globals.sql
#   <host>/<database>.dump
#   volumes/<volume>.tar
#
# --stop stops the containers of the compose project, except the databases, while dumping and
#   starts them again afterwards, also when the backup fails. pg_dump is already consistent
#   within one database, stopping only matters for consistency across databases and volumes.

# Idea of this script: Spawn a container which links up to any db, does the
#   dump through the network and then save the dump outside of the container.
#   For playing back an image, do the same thing but reverse.
# This makes the script swarm compatible as the databases don't necessarily
#   need to live on the same host.
# The container uses the image of the database it dumps, so the pg_dump version always
#   matches the server.

RESTORE_REFERENCE_URL="https://github.com/AEGEE/MyAEGEE/blob/stable/scripts-server/restore.sh"
LEGACY_RESTORE_URL="https://github.com/AEGEE/MyAEGEE/blob/b7a53beebc4e6ee1a9e7ed2bd6239a2cc55ec2b0/scripts-server/restore.sh"
BACKUP_REFERENCE_URL="https://myaegee.atlassian.net/wiki/spaces/AIT/pages/291897345/Using+backup+restore+scripts+for+MyAEGEE+data"
ALPINE_IMAGE="alpine:3.20"

stop_services=false
if [[ "${1}" == "--stop" ]]; then
  stop_services=true
  shift
fi

postgres_hosts=()
while [[ $# -gt 0 && "${1}" != "--" ]]; do
  postgres_hosts+=("${1}")
  shift
done
[[ "${1}" == "--" ]] && shift
volumes=("$@")

if [[ ${#postgres_hosts[@]} -eq 0 && ${#volumes[@]} -eq 0 ]]; then
  echo "Usage: dump.sh [--stop] [<postgres hosts>...] [-- <docker volumes>...]"
  exit 1
fi

backup_date="$(date +%Y-%m-%d_%H%M)"
backup_dir="${BACKUP_DIR:-/opt/backups}"
network="${BACKUP_NETWORK:-OMS}"

output_file="${backup_dir}/backup-${backup_date}.tgz"
log_file="${backup_dir}/backup-${backup_date}_result.log"

MAIN_DIR=$PWD # could be /opt/myaegee on prod and /vagrant in local
SCRIPT_DIR=$(cd "$(dirname "${0}")" && pwd)
cd "${backup_dir}" || exit 1

tmp_dir="$(mktemp -d "/tmp/myaegee-backup-$(date +%Y-%m-%d)-XXXXXX")" || exit 1

error=0

#shellcheck disable=SC2046
export $(grep -v '^#' "${MAIN_DIR}/.env" | xargs -d '\n')

log() {
  echo "$(date +%Y-%m-%dT%H:%M:%S) -- ${1} -- ${2}" | tee -a "${log_file}"
}

# Image of the running container of a postgres host (compose service, or container name)
pg_image() {
  local container
  container=$(docker ps -q --filter "label=com.docker.compose.project=${COMPOSE_PROJECT_NAME:-myaegee}" --filter "label=com.docker.compose.service=${1}" | head -n 1)
  docker container inspect --format '{{.Config.Image}}' "${container:-${1}}"
}

# No -t: a TTY would corrupt the binary output
pg_run() {
  local image=${1}
  shift
  docker run --rm --network="${network}" -e "PGPASSWORD=${PW_POSTGRES:-5ecr3t}" "${image}" "$@"
}

## STOPPING SERVICES

stopped_containers=()

start_services() {
  if [[ ${#stopped_containers[@]} -gt 0 ]]; then
    log INFO "Starting the stopped containers again"
    if ! docker start "${stopped_containers[@]}" > /dev/null; then
      log ERROR "Could not start all of ${stopped_containers[*]}"
      error=1
    fi
    stopped_containers=()
  fi
}

if $stop_services; then
  trap start_services EXIT
  trap 'exit 1' INT TERM
  mapfile -t stopped_containers < <(docker ps --filter "label=com.docker.compose.project=${COMPOSE_PROJECT_NAME:-myaegee}" \
    --format '{{.ID}} {{.Label "com.docker.compose.service"}}' | awk '$2 !~ /^(postgres|maria)-/ { print $1 }')
  if [[ ${#stopped_containers[@]} -gt 0 ]]; then
    log INFO "Stopping ${#stopped_containers[@]} containers before dumping"
    if ! docker stop "${stopped_containers[@]}" > /dev/null; then
      log ERROR "Could not stop all containers"
      error=1
    fi
  fi
fi

## BACKING UP

# Loop through postgres hosts
# For each host, dump the roles and then every database on its own
for host in "${postgres_hosts[@]}"; do
  if ! image=$(pg_image "${host}"); then
    log ERROR "Host:${host} ; No container found for ${host}"
    error=1
    continue
  fi
  mkdir -p "${tmp_dir}/${host}"

  if ! pg_run "${image}" pg_dumpall --globals-only -U postgres -h "${host}" > "${tmp_dir}/${host}/globals.sql"; then
    log ERROR "Host:${host} ; Something went wrong dumping the roles of ${host}"
    rm -f "${tmp_dir}/${host}/globals.sql"
    error=1
    continue
  fi

  if ! databases=$(pg_run "${image}" psql -U postgres -h "${host}" -At \
    -c "SELECT datname FROM pg_database WHERE datname NOT IN ('template0', 'template1', 'postgres') AND datallowconn ORDER BY datname"); then
    log ERROR "Host:${host} ; Something went wrong listing the databases of ${host}"
    error=1
    continue
  fi

  while read -r db; do
    [[ -z "${db}" ]] && continue
    if pg_run "${image}" pg_dump -Fc -U postgres -h "${host}" -d "${db}" > "${tmp_dir}/${host}/${db}.dump"; then
      log INFO "Host:${host} ; Database:${db} ; Done dumping ${db}"
    else
      log ERROR "Host:${host} ; Database:${db} ; Something went wrong dumping ${db}"
      # A partial dump would still be restorable and leave empty tables behind
      rm -f "${tmp_dir}/${host}/${db}.dump"
      error=1
    fi
  done <<< "${databases}"
  log INFO "Host:${host} ; Done dumping ${host}"
done

# Loop through volumes, mounted read-only into a throwaway container
for volume in "${volumes[@]}"; do
  mkdir -p "${tmp_dir}/volumes"
  # docker run would silently create a missing volume
  if ! docker volume inspect "${volume}" > /dev/null; then
    log ERROR "Volume:${volume} ; Volume ${volume} does not exist"
    error=1
    continue
  fi
  if docker run --rm -v "${volume}:/data:ro" "${ALPINE_IMAGE}" tar -cf - -C /data . > "${tmp_dir}/volumes/${volume}.tar"; then
    log INFO "Volume:${volume} ; Done archiving ${volume}"
  else
    log ERROR "Volume:${volume} ; Something went wrong archiving ${volume}"
    rm -f "${tmp_dir}/volumes/${volume}.tar"
    error=1
  fi
done

start_services

# TODO: Loop through maria host
# TODO: Loop through sqlite hosts (adopt the logic that as of now is on the makefile directly)

## ARCHIVING

# Write out information about the backup into the backup directory too, in case somebody opens it at some point in time because of confusion
cat >"${tmp_dir}/Readme.txt" << EOF
This backup was created on host "$(hostname)" on $(date +%Y-%m-%dT%H:%M:%S).
To restore it, use restore.sh <backup-file>.tgz
You can find restore.sh on ${RESTORE_REFERENCE_URL}

This backup contains:
- postgres hosts: ${postgres_hosts[*]}
  <host>/globals.sql is the output of pg_dumpall --globals-only (roles)
  <host>/<database>.dump is the output of pg_dump -Fc, restore it with pg_restore
- docker volumes: ${volumes[*]}
  volumes/<volume>.tar is a tar of the content of the volume

restore.sh restores every host and volume in the archive.
Backups made before the switch to pg_dump -Fc (one pg_dumpall file per host) can only be
restored with the old restore.sh from git history: ${LEGACY_RESTORE_URL}

For more instructions on how to perform a backup, check out:
${BACKUP_REFERENCE_URL}
EOF


# CDing is necessary to stop tar from creating the same directory structure in the archive
last_dir=$(pwd)
#shellcheck disable=SC2164
cd "${tmp_dir}"
if ! tar --absolute-names --force-local -czf output.tgz ./*; then
  log ERROR "Something went wrong compressing the backup"
  error=1
fi
#shellcheck disable=SC2164
cd "${last_dir}"
mv "${tmp_dir}/output.tgz" "${output_file}"
rm -rf "${tmp_dir}"

echo "$(date +%Y-%m-%dT%H:%M:%S) -- INFO -- Done compressing ${output_file}" | tee -a "${log_file}"

if [[ $(head -c 150 "${output_file}" | wc -c) -le 100 ]]
then
  echo "$(date +%Y-%m-%dT%H:%M:%S) -- ERROR -- File:${output_file} ; Something went wrong, archive ${output_file} is empty" | tee -a "${log_file}"
  error=1
fi

if [[ ! "$error" == "0" ]]
then
  echo "$(date +%Y-%m-%dT%H:%M:%S) -- ERROR -- File:${output_file} ; Backup unsuccessful" | tee -a "${log_file}"
  "${SCRIPT_DIR}/notify.py" FAILURE
else
  echo "$(date +%Y-%m-%dT%H:%M:%S) -- INFO -- File:${output_file} ; Backup successful, everything written to ${output_file}" | tee -a "${log_file}"
  "${SCRIPT_DIR}/notify.py" SUCCESS
fi
exit "${error}"

#TODO: rsync to bucket. Buckets are cheaper than HDD/SDD storage
