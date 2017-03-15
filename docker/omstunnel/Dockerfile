FROM golang


RUN go get -v github.com/githubnemo/CompileDaemon && \
	mkdir -p /usr/src/oms-tunnel

COPY ./restart.sh /usr/src

WORKDIR /usr/src/oms-tunnel

CMD CompileDaemon -exclude-dir=.git -command="sh /usr/src/restart.sh"