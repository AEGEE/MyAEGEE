#!/bin/bash
# Sourced by helper.sh and start.sh.
#
# load_env FILE: export every NAME=value line of FILE (a .env). It behaves like
# the old `export $(grep -v '^#' FILE | xargs -d '\n')`, except that a value
# with spaces (SMTP_NAME) stays whole, and it only needs bash 3.2 and no GNU
# tools, so it also works on macOS.
# Values are taken as written: quotes are kept and `$` isn't expanded. Dropped,
# as before: surrounding whitespace, a trailing CR, a leading `export ` and an
# inline ` # comment` after an unquoted value.
load_env ()
{
    local line name value
    while IFS= read -r line || [[ -n "${line}" ]]; do
        line=${line%$'\r'}
        line="${line#"${line%%[![:space:]]*}"}"
        line=${line#export }
        [[ "${line}" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]] || continue
        name=${line%%=*}
        value=${line#*=}
        if [[ "${value}" != [\"\']* ]]; then
            value=${value%%[[:space:]]#*}
        fi
        value="${value#"${value%%[![:space:]]*}"}"
        value="${value%"${value##*[![:space:]]}"}"
        export "${name}=${value}"
    done < "${1}"
}
