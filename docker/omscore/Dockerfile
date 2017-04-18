#--------------------------------------------------------------------------
# Image Setup
#--------------------------------------------------------------------------
#
# To edit the 'workspace' base Image, visit its repository on Github
#    https://github.com/LaraDock/workspace
#
# To change its version, see the available Tags on the Docker Hub:
#    https://hub.docker.com/r/laradock/workspace/tags/
#

FROM laradock/workspace:1.2

MAINTAINER Mahmoud Zalt <mahmoud@zalt.me>

#
#--------------------------------------------------------------------------
# Mandatory Software's Installation
#--------------------------------------------------------------------------
#
# Mandatory Software's such as ("php7.0-cli", "git", "vim", ....) are
# installed on the base image 'laradock/workspace' image. If you want
# to add more Software's or remove existing one, you need to edit the
# base image (https://github.com/LaraDock/workspace).
#


#####################################
# Non-Root User:
#####################################

# Add a non-root user to prevent files being created with root permissions on host machine.
ARG PUID=1000
ARG PGID=1000
RUN groupadd -g $PGID laradock && \
    useradd -u $PUID -g laradock -m laradock

#####################################
# Set Timezone
#####################################

ARG TZ=UTC
ENV TZ ${TZ}
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

USER laradock

#####################################
# Non-root user : PHPUnit path
#####################################

# add ./vendor/bin to non-root user's bashrc (needed for phpunit)

RUN echo "" >> ~/.bashrc && \
    echo 'export PATH="/var/www/vendor/bin:$PATH"' >> ~/.bashrc

#####################################
# Copy own scripts
#####################################
COPY ./.env /var/shared/core/.env
COPY ./bootstrap.sh /var/shared/core/bootstrap.sh

USER root
RUN git clone https://github.com/AEGEE/oms-neo-core.git /var/www
RUN chown -R laradock:laradock /var/www \
    && chown -R laradock:laradock /var/shared/core

#
#--------------------------------------------------------------------------
# Final Touch
#--------------------------------------------------------------------------
#

# Clean up
USER root
RUN apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Set default work directory
WORKDIR /var/www


#PROBLEM: on build time the orchestrator has not started 
#postgre yet, so the command below would not effectively seed
#db and such
#RUN bash /root/bootstrap.sh
