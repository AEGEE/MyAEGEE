# getting the docker setup
cd test
mkdir oms-testing || echo "test/oms-testing folder already exists"
cd oms-testing
git clone --branch dev-integrate https://github.com/AEGEE/oms-docker.git

# getting modules
cd oms-docker
git clone --branch develop https://github.com/AEGEE/oms-neo-core oms-core
git clone https://github.com/AEGEE/oms-serviceregistry

tee .env <<EOF
PATH_OMS_GLOBAL=oms-global/docker/
PATH_OMS_CORE=oms-core/docker/
PATH_OMS_REGISTRY=oms-serviceregistry/docker/

ENABLED_SERVICES=oms-global:oms-core:oms-serviceregistry
EOF

# waiting for testing setup to start
./oms.sh up -d

sleep_count=0
timeout=300

while [ 1 ]
do
    if [ "$sleep_count" -gt "$timeout" ]
    then
        echo "Failed to start OMS: timeout."
        exit 1
    fi
    output=`curl -s http://localhost/service/health/ping | grep "up and running"`

    if [ -n "$output" ]
    then
        break
    fi
    
    echo "Sleeping for $sleep_count seconds..."

    sleep 1
    sleep_count=$((sleep_count + 1))
done

echo "OMS test setup is loaded."

cd ../../..
cp lib/config/configFile.json.example lib/config/configFile.json

echo "Running tests..."
export NODE_ENV=test
TESTS_OK=true # we still need to send test report to Coveralls whatever the tests status is

./node_modules/.bin/nyc ./node_modules/mocha/bin/_mocha --timeout 10000 test/api/*.js || TESTS_OK=false
./node_modules/.bin/nyc report --reporter=text-lcov | ./node_modules/coveralls/bin/coveralls.js 

if [ "$TESTS_OK" = false ]
then
    echo "Tests failed."
    exit 2
fi

echo "Tests are OK."

cd test/oms-testing/oms-docker
./oms.sh down

echo "OMS test setup is stopped."
