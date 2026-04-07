# Multi-platform support (linux/amd64, linux/arm64)
FROM --platform=$BUILDPLATFORM elixir:1.14-alpine

RUN mkdir -p /usr/src/myapp \
	&& mkdir -p /usr/src/scripts \
	&& mix local.hex --force \
  	&& mix local.rebar --force \
	&& apk add --update --no-cache nodejs make gcc g++ curl cmake zlib-dev perl bsd-compat-headers

WORKDIR /usr/src/myapp

COPY mix.exs mix.lock /usr/src/myapp/
RUN ["mix", "deps.get", "--locked"]

COPY config /usr/src/myapp/config
COPY lib /usr/src/myapp/lib
COPY test /usr/src/myapp/test

# Inject version from CI if provided (defaults to whatever is in package.json).
# Uses sed instead of npm version because npm is not installed in the elixir image.
ARG PACKAGE_VERSION
COPY package.json /usr/src/myapp/package.json
RUN if [ -n "$PACKAGE_VERSION" ]; then sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$PACKAGE_VERSION\"/" package.json; fi

ARG MIX_ENV=production
ENV MIX_ENV=${MIX_ENV}
ENV PORT=4000
RUN ["mix", "compile"]

EXPOSE ${PORT}

CMD ["mix", "phx.server"]
