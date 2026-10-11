#!/bin/bash

# Restore an earlier backup done by dump.sh
# Before executing make sure nobody is accessing the databases, i.e. stop all services except for the actual databases
#
# Supports both:
# - New custom format dumps (.dump files) created with pg_dump -Fc (parallel restore)
# - Legacy text format dumps created with pg_dumpall (backward compatible)

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

## RESTORE DATABASES

# Detect backup format by looking for .dump files (new custom format)
#shellcheck disable=SC2207
dump_files=( $(find "${tmp_folder}" -name "postgres-*-*.dump" -type f 2>/dev/null) )

if [[ ${#dump_files[@]} -gt 0 ]]; then
  echo "Detected custom format backup (.dump files) - using pg_restore with parallel restore"

  # First, restore global objects (roles, tablespaces) for each host
  #shellcheck disable=SC2207
  global_files=( $(find "${tmp_folder}" -name "postgres-*-globals.sql" -type f 2>/dev/null) )
  for global_file in "${global_files[@]}"; do
    host=$(basename "${global_file}" | sed 's/^postgres-//; s/-globals\.sql$//')
    echo "Restoring global objects for host ${host}"

    active_users=$(docker run --rm -t --network="OMS" -e "PGPASSWORD=${PW_POSTGRES:-5ecr3t}" "postgres:${POSTGRES_VERSION}" psql -U postgres -h "${host}" -t -c "SELECT COUNT(*) FROM pg_stat_activity WHERE datname != 'postgres'" | tr -d '[:space:]')
    if [[ ${active_users} -gt 0 ]]; then
      echo "Warning: Detected ${active_users} active connections on ${host}"
    fi

    cat "${global_file}" | docker run -i --network="OMS" -e "PGPASSWORD=${PW_POSTGRES:-5ecr3t}" "postgres:${POSTGRES_VERSION}" psql -U postgres -h "${host}"
  done

  # Then restore each database dump with pg_restore
  for dump_file in "${dump_files[@]}"; do
    error=0
    # Extract host and dbname from filename: postgres-{host}-{dbname}.dump
    filename=$(basename "${dump_file}")
    # Remove postgres- prefix and .dump suffix, then split on the first dash to get host and dbname
    name_part="${filename#postgres-}"
    name_part="${name_part%.dump}"
    # The host name may contain dashes, so we need to figure out where the host ends and dbname begins
    # Strategy: try to match known postgres host patterns, or use the last dash as separator
    # We use the convention that the dbname is the last component after the final dash
    # But host names like postgres-core also have dashes. The dump file format is postgres-{host}-{dbname}.dump
    # where {host} is the full container name (e.g., postgres-core) and {dbname} is the database name
    # Since host names start with "postgres-", and we stripped the leading "postgres-", the name_part
    # looks like e.g. "postgres-core-mydb". We need to find where host ends and dbname begins.
    # We'll query the host to check which database exists.

    # Simpler approach: the host part always starts with "postgres-" in the original filename.
    # Filename: postgres-{FULL_HOST}-{DBNAME}.dump
    # We know hosts look like: postgres-core, postgres-events, postgres-network, etc.
    # So name_part after stripping leading "postgres-" is like: "core-mydb", "events-mydb"
    # Let's try each possible split point
    restored=false
    # Try splitting name_part at each dash from left to right
    IFS='-' read -ra parts <<< "${name_part}"
    for ((i=1; i<${#parts[@]}; i++)); do
      # Build host candidate: "postgres-" + first i parts
      host_suffix=""
      for ((j=0; j<i; j++)); do
        if [[ -n "$host_suffix" ]]; then
          host_suffix="${host_suffix}-${parts[$j]}"
        else
          host_suffix="${parts[$j]}"
        fi
      done
      host="postgres-${host_suffix}"

      # Build dbname: remaining parts
      dbname=""
      for ((k=i; k<${#parts[@]}; k++)); do
        if [[ -n "$dbname" ]]; then
          dbname="${dbname}-${parts[$k]}"
        else
          dbname="${parts[$k]}"
        fi
      done

      # Check if this host exists as a docker container
      if docker ps --format '{{.Names}}' | grep -q "^myaegee_${host}_1$\|^${host}$"; then
        echo "Restoring database ${dbname} on host ${host}"

        active_users=$(docker run --rm -t --network="OMS" -e "PGPASSWORD=${PW_POSTGRES:-5ecr3t}" "postgres:${POSTGRES_VERSION}" psql -U postgres -h "${host}" -t -c "SELECT COUNT(*) FROM pg_stat_activity WHERE datname = '${dbname}'" | tr -d '[:space:]')
        if [[ ${active_users} -gt 0 ]]; then
          echo "Warning: Detected ${active_users} active connections to ${dbname} on ${host}, restore may fail"
          read -p "Continue restoring ${dbname} on ${host}? (y/n) " -n 1 -r
          echo
          if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Skipping ${dbname} on ${host}"
            restored=true
            break
          fi
        fi

        # Create database if it doesn't exist
        docker run --rm -t --network="OMS" -e "PGPASSWORD=${PW_POSTGRES:-5ecr3t}" "postgres:${POSTGRES_VERSION}" \
          psql -U postgres -h "${host}" -tc "SELECT 1 FROM pg_database WHERE datname = '${dbname}'" | grep -q 1 \
          || docker run --rm -t --network="OMS" -e "PGPASSWORD=${PW_POSTGRES:-5ecr3t}" "postgres:${POSTGRES_VERSION}" \
            psql -U postgres -h "${host}" -c "CREATE DATABASE \"${dbname}\""

        # Restore using pg_restore with parallel jobs for speed
        # Custom format requires a seekable file, so we mount it into the container
        docker run --rm --network="OMS" -e "PGPASSWORD=${PW_POSTGRES:-5ecr3t}" \
          -v "${dump_file}:/tmp/restore.dump:ro" "postgres:${POSTGRES_VERSION}" \
          pg_restore -U postgres -h "${host}" -d "${dbname}" -j 4 --clean --if-exists /tmp/restore.dump

        echo "Done restoring ${dbname} on ${host}"
        restored=true
        break
      fi
    done

    if ! $restored; then
      echo "ERROR: Could not determine host/database for dump file ${filename}. Skipping."
      error=1
    fi
  done

else
  echo "Detected legacy text format backup - using psql restore"
  # Legacy restore path for old-style pg_dumpall text dumps
  # Auto-detect postgres hosts from files in the archive
  #shellcheck disable=SC2207
  legacy_files=( $(find "${tmp_folder}" -name "postgres-*" -type f ! -name "*.dump" ! -name "*.sql" 2>/dev/null) )

  for file in "${legacy_files[@]}"; do
    error=0
    name=$(basename "${file}")
    # The file is named "postgres-{host}", extract the host name
    host="${name}"

    echo "Restoring postgres host ${host} (legacy text format)"

    if [[ $(wc -c <"${file}") -le 100 ]]; then
      echo "Something went wrong replaying ${host}, file ${file} is empty"
      error=1
    fi

    # The host name in the file is "postgres-{host}" but the actual docker host is just "{host}"
    # However in the old dump.sh, the host passed was already the full name like "postgres-core"
    # and the file was named "postgres-postgres-core". Let's handle both cases.
    # Try the name as-is first (stripping the "postgres-" file prefix)
    actual_host="${name#postgres-}"

    active_users=$(docker run --rm -t --network="OMS" -e "PGPASSWORD=${PW_POSTGRES:-5ecr3t}" "postgres:${POSTGRES_VERSION}" psql -U postgres -h "${actual_host}" -t -c "SELECT COUNT(*) FROM pg_stat_activity WHERE datname != 'postgres'" | tr -d '[:space:]')
    if [[ ${active_users} -gt 0 ]]; then
      echo "Detected ${active_users} active connections to the database, the restore will most likely fail"
      error=1
    fi

    if [[ $error -ne 0 ]]; then
      read -p "Errors occurred, are you sure you want to restore ${actual_host} (y/n) " -n 1 -r
      echo
      if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        continue
      fi
    fi

    cat "${file}" | docker run -i --network="OMS" -e "PGPASSWORD=${PW_POSTGRES:-5ecr3t}" "postgres:${POSTGRES_VERSION}" psql -U postgres -h "${actual_host}"
  done
fi

## RESTORE VOLUMES

# Restore volumes using rsync (works for both new and old backup formats)
#shellcheck disable=SC2207
volume_files=( $(find "${tmp_folder}" -name "volume-*.tar" -type f 2>/dev/null) )

for vol_file in "${volume_files[@]}"; do
  error=0
  filename=$(basename "${vol_file}")
  # Extract volume name from filename: volume-{volname}.tar
  vol="${filename#volume-}"
  vol="${vol%.tar}"

  echo "Restoring volume ${vol}"

  if [[ $(wc -c <"${vol_file}") -le 100 ]]; then
    echo "The volume backup for ${vol} is empty"
    error=1
  fi

  if [[ $(docker volume ls -q | grep -c "^${vol}$") -eq 0 ]]; then
    echo "Docker volume ${vol} does not exist, creating it"
    docker volume create "${vol}"
  fi

  if [[ $error -ne 0 ]]; then
    read -p "Errors occurred, are you sure you want to restore volume ${vol}? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      continue
    fi
  fi

  # Restore the tar archive into the volume
  docker run --rm --name "${vol}-restorer" -v "${vol}:/data" -v "${vol_file}:/backup.tar:ro" \
    alpine:3 sh -c "rm -rf /data/* && tar xf /backup.tar -C /data"

  echo "Done restoring volume ${vol}"
done

rm -r "${tmp_folder}"
