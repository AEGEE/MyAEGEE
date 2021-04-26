ARG ELK_VERSION

# https://github.com/elastic/logstash-docker
FROM docker.elastic.co/logstash/logstash-oss:${ELK_VERSION}

# Add your logstash plugins setup here
# Example: RUN logstash-plugin install logstash-filter-json
RUN logstash-plugin install logstash-filter-prune \
 && logstash-plugin install logstash-filter-geoip \
 && logstash-plugin install logstash-filter-useragent \
 && logstash-plugin install logstash-filter-json \
 && logstash-plugin install logstash-filter-kv \
 && logstash-plugin install logstash-filter-grok
