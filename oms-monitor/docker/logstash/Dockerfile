ARG ELK_VERSION

# https://github.com/elastic/logstash-docker
FROM docker.elastic.co/logstash/logstash-oss:${ELK_VERSION}

# Add your logstash plugins setup here
# Example: RUN logstash-plugin install logstash-filter-json
RUN logstash-plugin install logstash-filter-prune
RUN logstash-plugin install logstash-filter-geoip
RUN logstash-plugin install logstash-filter-useragent
RUN logstash-plugin install logstash-filter-json
RUN logstash-plugin install logstash-filter-kv
RUN logstash-plugin install logstash-filter-grok
