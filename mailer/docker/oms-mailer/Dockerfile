FROM elixir:1.8-alpine

RUN mkdir -p /usr/src/myapp \
	&& mkdir -p /usr/src/scripts \
	&& mix local.hex --force \
  && mix local.rebar --force \
	&& apk add --update --no-cache nodejs nodejs-npm make gcc g++ curl

WORKDIR /usr/src/myapp

COPY mix.exs /usr/src/myapp/mix.exs
RUN ["mix", "deps.get"]

COPY config /usr/src/myapp/config
COPY lib /usr/src/myapp/lib
COPY test /usr/src/myapp/test
COPY package.json /usr/src/myapp/package.json

ARG MIX_ENV=production
ENV MIX_ENV=${MIX_ENV}
ENV PORT=4000
RUN ["mix", "compile"]

EXPOSE ${PORT}

CMD mix phx.server
