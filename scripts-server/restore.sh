#!/bin/bash

# Restore an earlier backup done by dump.sh
# Before executing make sure nobody is accessing the databases, i.e. stop all services except for the actual databases

postgres_hosts=(postgres-core postgres-oms-statutory postgres-oms-events)
#postgres_hosts=($2) #FIXME still to test

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

#volumes=(myaegee_oms-events-media)

input_file=$1

if [[ ! $1 ]]
then
  echo "Usage: restore.sh <backup>.tgz"
  exit 1
fi

tmp_folder="/tmp/backup-$(head /dev/urandom | tr -dc A-Za-z0-9 | head -c 13)"
mkdir -p "${tmp_folder}"
tar --force-local --one-top-level="${tmp_folder}" -xvf "${input_file}"

cd "${tmp_folder}" || exit 4


for name in ${postgres_hosts[*]} #FOREACH because the backup folder could have more dbs
do
  error=0
  echo "Restoring postgres host ${name}"
  file="${tmp_folder}/${name}" #the postgres- prefix is already present in the name

  if [[ $(wc -c <"${file}") -le 100 ]]
  then
    echo "Something went wrong replaying ${name}, file ${file} is empty"
    error=1
  fi

  active_users=$(docker run --rm -t --network="OMS" -e "PGPASSWORD=${PW_POSTGRES:-5ecr3t}" "postgres:${POSTGRES_VERSION}" psql -U postgres -h "${name}" -t -c "SELECT COUNT(*) FROM pg_stat_activity WHERE datname != 'postgres'" | tr -d '[:space:]')
  if [[ ${active_users} -gt 0 ]]
  then
    echo "Detected ${active_users} active connections to the database, the restore will most likely fail"
    error=1
  fi


  if [[ $error -ne 0 ]]
  then
    read -p "Errors occured, are you sure you want to restore ${name} (y/n)" -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]
    then
        error=0
    fi
  fi

  if [[ $error -eq 0 ]]
  then
    cat "${file}" | docker run -i --network="OMS" -e "PGPASSWORD=${PW_POSTGRES:-5ecr3t}" "postgres:${POSTGRES_VERSION}" psql -U postgres -h "${name}"
  fi
done

# Restore a volume using rsync
# That way only actual necessary changes should be copied over and not the entire directory
# TODO change this to use the clone_volume utility instead, if they do the same thing
for vol in ${volumes[*]}
do
  error=0
  echo "Restoring volume ${vol}"
  file="${tmp_folder}/volume-${vol}"

  if [[ $(find "${file}" -maxdepth 50 -type f | wc -l) -eq 0 ]]
  then
    echo "The volume you want to restore is empty"
    error=1
  fi

  if [[ $(docker volume ls | grep "${vol}" | wc -l) -eq 0 ]]
  then
    echo "Docker volume ${vol} does not exist"
    error=1
  fi

  if [[ $error -ne 0 ]]
  then
    read -p "Errors occured, are you sure you want to restore ${vol} (y/n)" -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]
    then
        error=0
    fi
  fi

  if [[ $error -eq 0 ]]
  then
    docker run --rm --name "${vol}" -t -v "${vol}:/tmp/dest" -v "${file}:/tmp/source" --entrypoint /usr/bin/rsync eeacms/rsync:2.1 -arv /tmp/source/ /tmp/dest
  fi
done


rm -r "${tmp_folder}"
