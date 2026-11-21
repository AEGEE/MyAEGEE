#!/bin/bash

# Restore an earlier backup done by dump.sh
# Before executing make sure nobody is accessing the databases, i.e. stop all services except for the actual databases
#
# Usage: restore.sh <backup>.tgz
# Restores every postgres host and volume in the archive, reading them from its layout:
#   <host>/globals.sql      roles, restored first
#   <host>/<database>.dump  restored with pg_restore --clean --if-exists, the database is created if missing
#   volumes/<volume>.tar    the volume is created if missing and its content replaced
#
# Archives made before the switch to pg_dump -Fc (one pg_dumpall file per host) are not supported,
#   restore them with the old restore.sh from git history:
#   https://github.com/AEGEE/MyAEGEE/blob/b7a53beebc4e6ee1a9e7ed2bd6239a2cc55ec2b0/scripts-server/restore.sh
#
# Run it from the MyAEGEE folder (for .env) on the docker host: the backup files are mounted into the containers.

ALPINE_IMAGE="alpine:3.20"
network="${BACKUP_NETWORK:-OMS}"

input_file=$1

if [[ ! -f $1 ]]
then
  echo "Usage: restore.sh <backup>.tgz"
  exit 1
fi

if [[ -f .env ]]; then
  #shellcheck disable=SC2046
  export $(grep -v '^#' .env | xargs -d '\n')
fi

tmp_folder="$(mktemp -d /tmp/backup-XXXXXXXXXXXXX)" || exit 4
trap 'rm -rf "${tmp_folder}"' EXIT
tar --force-local -xzf "${input_file}" -C "${tmp_folder}" || exit 4

# Image of the running container of a postgres host (compose service, or container name)
pg_image() {
  local container
  container=$(docker ps -q --filter "label=com.docker.compose.project=${COMPOSE_PROJECT_NAME:-myaegee}" --filter "label=com.docker.compose.service=${1}" | head -n 1)
  docker container inspect --format '{{.Config.Image}}' "${container:-${1}}"
}

# Runs a postgres client with the image of the host, mounting a file of the backup if given
pg_run() {
  local image=${1} file=${2}
  shift 2
  docker run --rm --network="${network}" -e "PGPASSWORD=${PW_POSTGRES:-5ecr3t}" ${file:+-v "${file}:/tmp/restore:ro"} "${image}" "$@"
}

failed=0
restored=0

## RESTORING POSTGRES HOSTS

for host_dir in "${tmp_folder}"/*/
do
  [[ -d "${host_dir}" ]] || continue
  host=$(basename "${host_dir}")
  [[ "${host}" == "volumes" ]] && continue
  restored=1
  echo "Restoring postgres host ${host}"

  if ! image=$(pg_image "${host}"); then
    echo "No container found for ${host}, skipping it"
    failed=1
    continue
  fi

  if ! active_users=$(pg_run "${image}" "" psql -U postgres -h "${host}" -At -c "SELECT COUNT(*) FROM pg_stat_activity WHERE datname != 'postgres'"); then
    echo "Could not connect to ${host}, skipping it"
    failed=1
    continue
  fi
  if [[ ${active_users} -gt 0 ]]
  then
    echo "Detected ${active_users} active connections to the database, the restore will most likely fail"
    read -p "Are you sure you want to restore ${host} (y/n)" -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]
    then
      echo "Skipping ${host}"
      failed=1
      continue
    fi
  fi

  # Errors about roles that already exist (e.g. postgres) are expected here
  if [[ -f "${host_dir}globals.sql" ]] && ! pg_run "${image}" "${host_dir}globals.sql" psql -U postgres -h "${host}" -q -f /tmp/restore; then
    echo "Something went wrong restoring the roles of ${host}"
    failed=1
  fi

  for dump in "${host_dir}"*.dump
  do
    [[ -f "${dump}" ]] || continue
    db=$(basename "${dump}" .dump)
    echo "Restoring database ${db} on ${host}"

    if [[ -z $(pg_run "${image}" "" psql -U postgres -h "${host}" -At -c "SELECT 1 FROM pg_database WHERE datname = '${db}'") ]]; then
      echo "Database ${db} does not exist on ${host}, creating it"
      if ! pg_run "${image}" "" psql -U postgres -h "${host}" -q -c "CREATE DATABASE \"${db}\""; then
        failed=1
        continue
      fi
    fi

    # pg_restore -j needs a seekable file, so the dump is mounted instead of piped
    if ! pg_run "${image}" "${dump}" pg_restore -U postgres -h "${host}" -d "${db}" -j 4 --clean --if-exists /tmp/restore; then
      echo "Something went wrong restoring ${db} on ${host}"
      failed=1
    fi
  done
done

## RESTORING VOLUMES

for tarball in "${tmp_folder}"/volumes/*.tar
do
  [[ -f "${tarball}" ]] || continue
  restored=1
  vol=$(basename "${tarball}" .tar)
  echo "Restoring volume ${vol}"

  if ! docker volume inspect "${vol}" > /dev/null 2>&1
  then
    echo "Docker volume ${vol} does not exist, creating it"
    if ! docker volume create "${vol}" > /dev/null; then
      failed=1
      continue
    fi
  fi

  if ! docker run --rm -v "${vol}:/data" -v "${tarball}:/backup.tar:ro" "${ALPINE_IMAGE}" \
    sh -c 'tar -xOf /backup.tar > /dev/null && find /data -mindepth 1 -delete && tar -xf /backup.tar -C /data'; then
    echo "Something went wrong restoring volume ${vol}"
    failed=1
  fi
done

if [[ ${restored} -eq 0 ]]; then
  echo "Nothing to restore in ${input_file}. Archives made with pg_dumpall need the old restore.sh, see the top of this script"
  failed=1
fi

exit "${failed}"
