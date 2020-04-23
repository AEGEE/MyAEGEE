#!/bin/bash
# #THIS IS RUN ON THE GUEST MACHINE
# # By Vagrant

# echo "[pw set] not yet implemented"
# exit 0

# #quit silently if no file to change
# if [ ! -f oms-docker/.env ]; then
#   #echo "[Password setter] no .env file, quitting"
#   exit 0
# fi

# #check if we should NOT be strict (default: strict, to enforce secure policy)
# strict="true"
# if [ $# -eq 2 ]; then
#   if [ "$1" == "--loose" ]; then
#     strict="false"
#   fi
# else
#   echo -e "Usage: password-setter.sh [--loose], assuming strict"
# fi
# #strict mode requires all passwords to be set and exits complaining
# #loose mode just exits (?)

# #Passwords set until now:
# OMSCORE_PW="superAdmin"
# OMSCORE_PW_LOCATION="oms-core/.env"
# #PW_POSTGRES=superAdmin #oms-core/docker/docker-compose.yml BUT you can put it in the above file and make the composer take it from there
# #PW_PGADMIN=superAdmin #set in the container probably
# #PW_MONGO=superAdmin #?
# #PW_MONGOADMIN=superAdmin #oms-global/docker/mongoui/app.json
# #PW_MEDIAWIKI=superAdmin
# #PW_LIMESURVEY=superAdmin
# #PW_MONITORING=superAdmin

# passwords=($OMSCORE_PW)
# locations=($OMSCORE_PW_LOCATION)

# COUNTER=0
# while [  $COUNTER -lt ${#passwords[@]} ]; do
#  currPw=${passwords[$COUNTER]}
#  currServ=${locations[$COUNTER]}
#  sed -i s/adminpass/$currPw/ "$currServ"
#  let COUNTER=COUNTER+1
# done



# #others:
# #bugsnagKey in configFile.json of oms-events/docker
# #oauth keys in .env of oms-core
