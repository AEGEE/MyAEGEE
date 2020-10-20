#!/bin/bash

# Usage: dump.sh <name of the postgres hosts to backup>
# The backup location is /opt/backups

# Idea of this script: Spawn a container which links up to any db, does the
#   dump through the network and then save the dump outside of the container.
#   For playing back an image, do the same thing but reverse.
# This makes the script swarm compatible as the databases don't necessarily
#   need to live on the same host.

RESTORE_REFERENCE_URL="https://github.com/AEGEE/infrastructure"
BACKUP_REFERENCE_URL="https://myaegee.atlassian.net/wiki/spaces/AIT/pages/291897345/Using+backup+restore+scripts+for+MyAEGEE+data"

#shellcheck disable=SC2206
postgres_hosts=(${@})

backup_date="$(date +%Y-%m-%d_%H%M)"
backup_dir="/opt/backups"

output_file="${backup_dir}/backup-${backup_date}.tgz"
log_file="${backup_dir}/backup-${backup_date}_result.log"


tmp_dir="/tmp/myaegee-backup-$(date +%Y-%m-%d)"

mkdir -p "${tmp_dir}"

#shellcheck disable=SC2164
cd "${backup_dir}"

error=0

#shellcheck disable=SC2046
export $(grep -v '^#' /opt/MyAEGEE/.env | xargs -d '\n')

## BACKING UP

# Loop through postgres host
# For each host, spawn a container which will pull all information with pg_dumpall
for host in ${postgres_hosts[*]}; do
  file="${tmp_dir}/postgres-${host}"
  docker run --rm --name "${host}-backupper"  -t --network="OMS" -e "PGPASSWORD=${PW_POSTGRES:-postgres}" postgres:10 pg_dumpall -c -U postgres -h "${host}" > "${file}"

#shellcheck disable=SC2086
  if [[ $(wc -c <${file}) -le 100 ]]
  then
    echo "$(date +%Y-%m-%dT%H:%M:%S) -- ERROR -- Host:${host} ; File:${file} ; Something went wrong dumping ${host}, file ${file} is empty" | tee -a "${log_file}"
    error=1
  fi
  echo "$(date +%Y-%m-%dT%H:%M:%S) -- INFO -- Host:${host} ; Done dumping ${host}" | tee -a "${log_file}"
done

# TODO: Loop through maria host
# TODO: Loop through sqlite hosts
# TODO: Loop through volumes (calling the external script)

## ARCHIVING

# Write out information about the backup into the backup directory too, in case somebody opens it at some point in time because of confusion
# NB: the readme will have the correct values for the postgres_hosts, after the substitution
cat >"${tmp_dir}/Readme.txt" << EOF
This backup was created on host "$(hostname)" on $(date +%Y-%m-%dT%H:%M:%S).
To restore it, use restore.sh <backup-file>.tgz
You can find restore.sh on ${RESTORE_REFERENCE_URL}

Make sure you set the first lines in restore.sh like this, or with less entries:
postgres_hosts=("${postgres_hosts[@]}")
mongo_volumes=("${mongo_volumes[@]}")

This backup only contains the above postgres backups and volumes.
You will find them in folders/files prefixed postgres- and volumes- in this archive.
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
  exit $error
else
  echo "$(date +%Y-%m-%dT%H:%M:%S) -- INFO -- File:${output_file} ; Backup successful, everything written to ${output_file}" | tee -a "${log_file}"
fi

#TODO: rsync to bucket. Buckets are cheaper than HDD/SDD storage
