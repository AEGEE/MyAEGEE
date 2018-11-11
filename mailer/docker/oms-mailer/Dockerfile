FROM elixir:alpine

RUN mkdir -p /usr/src/myapp \
	&& mkdir -p /usr/src/scripts \
	&& mix local.hex --force \
  && mix local.rebar --force \
	&& apk add --update --no-cache nodejs nodejs-npm make gcc g++

ADD config /usr/src/myapp/config
ADD lib /usr/src/myapp/lib
ADD mix.exs /usr/src/myapp/mix.exs

WORKDIR /usr/src/myapp

ENV MIX_ENV=prod
ENV PORT=4000
RUN ["mix", "deps.get"]
RUN ["mix", "compile"]

EXPOSE 4000

CMD mix phx.server