FROM elixir:1.8-alpine

RUN mkdir -p /usr/src/myapp \
	&& mkdir -p /usr/src/scripts \
	&& mix local.hex --force \
  && mix local.rebar --force \
	&& apk add --update --no-cache nodejs nodejs-npm make gcc g++

WORKDIR /usr/src/myapp

COPY mix.exs /usr/src/myapp/mix.exs
RUN ["mix", "deps.get"]

COPY config /usr/src/myapp/config
COPY lib /usr/src/myapp/lib
COPY test /usr/src/myapp/test


ENV MIX_ENV=prod
ENV PORT=4000
RUN ["mix", "compile"]

EXPOSE 4000

CMD mix phx.server
