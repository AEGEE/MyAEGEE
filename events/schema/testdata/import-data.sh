#!/bin/bash

# Imports all *.ldif files from the same directory using ldapadd.
# Usage: ./import-data.sh <rootdn> <rootpw>

ROOTDN="$1"
ROOTPW="$2"

cd "$(dirname ${BASH_SOURCE[0]})"

ls *.ldif | sort | while read file
do
    /usr/bin/ldapadd -x -D "$ROOTDN" -w "$ROOTPW" -f "$file" -c
done

touch .dataimported
