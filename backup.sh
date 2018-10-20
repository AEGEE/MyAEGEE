# Creates backup of everything.
DATE=`date '+%Y-%m-%d_%H:%M:%S'`
DIR_NAME=backup_$DATE

mkdir $DIR_NAME
cd $DIR_NAME

# 1. PostgreSQL backup.
echo "Back up PosgreSQL for oms-core..."
bash ../oms.sh exec postgres-oms-core-elixir pg_dump 'postgresql://postgres:postgres@localhost/omscore_dev' > oms_core.backup
echo "Back up PosgreSQL for oms-statutory..."
bash ../oms.sh exec postgres-oms-statutory pg_dump 'postgresql://postgres:postgres@localhost/omscore_dev' > oms_statutory.backup

# 2. MongoDB backup
echo "Back up MongoDB for oms-events..."
bash ../oms.sh exec mongodb mongodump -d events --archive=oms_events.backup.gz
# docker-compose doesn't support cp yet :(
docker cp oms-docker_mongodb_1:/oms_events.backup.gz oms_events.backup.gz

# 3. Backup of folders with user data (e.g. pictures)
echo "Back up media for oms-events..."
docker cp oms-docker_oms-events_1:/usr/app/media oms_events.media
cd ..

zip -r $DIR_NAME.zip $DIR_NAME
rm -rf $DIR_NAME
