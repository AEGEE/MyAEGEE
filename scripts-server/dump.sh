#!/bin/bash

# Usage: dump.sh <name of the postgres hosts to backup> [-- <docker volumes to backup>]
# The backup location is /opt/backups
#
# Example: dump.sh postgres-core postgres-events -- core-media events-media
#
# Uses pg_dump in custom format (-Fc) for each database, which is compressed
# and supports parallel restore via pg_restore -j.

# Idea of this script: Spawn a container which links up to any db, does the
#   dump through the network and then save the dump outside of the container.
#   For playing back an image, do the same thing but reverse.
# This makes the script swarm compatible as the databases don't necessarily
#   need to live on the same host.

#to get postgres version programmatically (wip): docker ps | grep postgres | awk '{print $2}'
# NB weak because every ms may have a different version of postgres
POSTGRES_VERSION="10.21"
#shellcheck disable=SC2207
POSTGRES_DETECTED=( $(docker ps | grep postgres | awk '{print $2}') )

stringContain() { case $2 in *$1* ) return 0;; *) return 1;; esac ;}

for PG in "${POSTGRES_DETECTED[@]}"; do
  if stringContain "$POSTGRES_VERSION" "$PG"; then
      printf 'Match: %-12s %s\n' "'$PG'" "'$POSTGRES_VERSION'"
  else
      printf 'No match: %s\n' "'$POSTGRES_VERSION'"
      echo "We assume version of postgres ${POSTGRES_VERSION} but there's a mismatch with ${PG}"
      echo "Have a manual check, fix, and retry"
      exit 0
  fi
done

RESTORE_REFERENCE_URL="https://github.com/AEGEE/MyAEGEE/blob/stable/scripts"
BACKUP_REFERENCE_URL="https://myaegee.atlassian.net/wiki/spaces/AIT/pages/291897345/Using+backup+restore+scripts+for+MyAEGEE+data"

# Parse arguments: postgres hosts before --, docker volumes after --
postgres_hosts=()
media_volumes=()
parsing_volumes=false

for arg in "$@"; do
  if [[ "$arg" == "--" ]]; then
    parsing_volumes=true
    continue
  fi
  if $parsing_volumes; then
    media_volumes+=("$arg")
  else
    postgres_hosts+=("$arg")
  fi
done

backup_date="$(date +%Y-%m-%d_%H%M)"
backup_dir="/opt/backups"

output_file="${backup_dir}/backup-${backup_date}.tgz"
log_file="${backup_dir}/backup-${backup_date}_result.log"


tmp_dir="/tmp/myaegee-backup-$(date +%Y-%m-%d)"

mkdir -p "${tmp_dir}"

MAIN_DIR=$PWD # could be /opt/myaegee on prod and /vagrant in local
SCRIPT_DIR=$(dirname "${0}")
#shellcheck disable=SC2164
cd "${backup_dir}"

error=0

#shellcheck disable=SC2046
export $(grep -v '^#' ${MAIN_DIR}/.env | xargs -d '\n')

## BACKING UP DATABASES

# Loop through postgres hosts
# For each host, query the list of databases and dump each one in custom format (-Fc)
# Custom format is compressed and supports parallel restore with pg_restore -j
for host in "${postgres_hosts[@]}"; do
  echo "$(date +%Y-%m-%dT%H:%M:%S) -- INFO -- Host:${host} ; Querying database list" | tee -a "${log_file}"

  # Get the list of databases, excluding templates and the default postgres db
  #shellcheck disable=SC2016
  databases=$(docker run --rm --name "${host}-lister" -t --network="OMS" \
    -e "PGPASSWORD=${PW_POSTGRES:-5ecr3t}" "postgres:${POSTGRES_VERSION}" \
    psql -U postgres -h "${host}" -t -A -c \
    "SELECT datname FROM pg_database WHERE datname NOT IN ('template0', 'template1', 'postgres')" \
    | tr -d '\r')

  if [[ -z "$databases" ]]; then
    echo "$(date +%Y-%m-%dT%H:%M:%S) -- ERROR -- Host:${host} ; No databases found or could not connect" | tee -a "${log_file}"
    error=1
    continue
  fi

  # Also dump global objects (roles, tablespaces) once per host
  global_file="${tmp_dir}/postgres-${host}-globals.sql"
  docker run --rm --name "${host}-globals-backupper" -t --network="OMS" \
    -e "PGPASSWORD=${PW_POSTGRES:-5ecr3t}" "postgres:${POSTGRES_VERSION}" \
    pg_dumpall -U postgres -h "${host}" --globals-only > "${global_file}"

  echo "$(date +%Y-%m-%dT%H:%M:%S) -- INFO -- Host:${host} ; Dumped global objects" | tee -a "${log_file}"

  for dbname in $databases; do
    file="${tmp_dir}/postgres-${host}-${dbname}.dump"
    echo "$(date +%Y-%m-%dT%H:%M:%S) -- INFO -- Host:${host} ; Dumping database ${dbname} in custom format" | tee -a "${log_file}"

    # Note: no -t flag here - tty corrupts binary custom format output
    docker run --rm --name "${host}-${dbname}-backupper" --network="OMS" \
      -e "PGPASSWORD=${PW_POSTGRES:-5ecr3t}" "postgres:${POSTGRES_VERSION}" \
      pg_dump -Fc -U postgres -h "${host}" "${dbname}" > "${file}"

    #shellcheck disable=SC2086
    if [[ $(wc -c <${file}) -le 100 ]]; then
      echo "$(date +%Y-%m-%dT%H:%M:%S) -- ERROR -- Host:${host} ; DB:${dbname} ; File:${file} ; Something went wrong, dump file is empty" | tee -a "${log_file}"
      error=1
    fi
    echo "$(date +%Y-%m-%dT%H:%M:%S) -- INFO -- Host:${host} ; DB:${dbname} ; Done dumping" | tee -a "${log_file}"
  done
done

## BACKING UP VOLUMES

# Loop through docker volumes and tar their contents
for vol in "${media_volumes[@]}"; do
  vol_file="${tmp_dir}/volume-${vol}.tar"
  echo "$(date +%Y-%m-%dT%H:%M:%S) -- INFO -- Volume:${vol} ; Backing up" | tee -a "${log_file}"

  # Check that the volume exists
  if ! docker volume inspect "${vol}" > /dev/null 2>&1; then
    echo "$(date +%Y-%m-%dT%H:%M:%S) -- ERROR -- Volume:${vol} ; Volume does not exist, skipping" | tee -a "${log_file}"
    error=1
    continue
  fi

  docker run --rm --name "${vol}-backupper" -v "${vol}:/data:ro" -v "${tmp_dir}:/backup" \
    alpine:3 tar cf "/backup/volume-${vol}.tar" -C /data .

  #shellcheck disable=SC2086
  if [[ ! -f "${vol_file}" ]] || [[ $(wc -c <${vol_file}) -le 100 ]]; then
    echo "$(date +%Y-%m-%dT%H:%M:%S) -- ERROR -- Volume:${vol} ; File:${vol_file} ; Something went wrong, volume backup is empty" | tee -a "${log_file}"
    error=1
  fi
  echo "$(date +%Y-%m-%dT%H:%M:%S) -- INFO -- Volume:${vol} ; Done backing up" | tee -a "${log_file}"
done

# TODO: Loop through maria host
# TODO: Loop through sqlite hosts (adopt the logic that as of now is on the makefile directly)

## ARCHIVING

# Write out information about the backup into the backup directory too, in case somebody opens it at some point in time because of confusion
# NB: the readme will have the correct values for the postgres_hosts, after the substitution
cat >"${tmp_dir}/Readme.txt" << EOF
This backup was created on host "$(hostname)" on $(date +%Y-%m-%dT%H:%M:%S).
To restore it, use restore.sh <backup-file>.tgz
You can find restore.sh on ${RESTORE_REFERENCE_URL}

This backup contains:
- PostgreSQL databases in custom format (.dump files) for hosts: ${postgres_hosts[*]}
- Global objects (roles/tablespaces) in .sql files for each host
- Docker volume backups (.tar files) for volumes: ${media_volumes[*]}

Database dumps use pg_dump custom format (-Fc) and can be restored with:
  pg_restore -j 4 --clean --if-exists -d <dbname> <file>.dump

For more instructions on how to perform a backup, check out:
${BACKUP_REFERENCE_URL}
EOF


# CDing is necessary to stop tar from creating the same directory structure in the archive
last_dir=$(pwd)
#shellcheck disable=SC2164
cd "${tmp_dir}"
tar --absolute-names --force-local -czf output.tgz ./*
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
  "${MAIN_DIR}/${SCRIPT_DIR}/notify.py" FAILURE
  exit $error
else
  echo "$(date +%Y-%m-%dT%H:%M:%S) -- INFO -- File:${output_file} ; Backup successful, everything written to ${output_file}" | tee -a "${log_file}"
  "${MAIN_DIR}/${SCRIPT_DIR}/notify.py" SUCCESS
fi

#TODO: rsync to bucket. Buckets are cheaper than HDD/SDD storage
