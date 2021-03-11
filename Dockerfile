FROM node:12.8.0-slim

RUN apt update

# Install Chrome deps
RUN apt-get update && apt-get install -y -q --no-install-recommends \
        libgtk-3-dev \
        libx11-xcb1  \
        libnss3 \
        libxss1 \
        libasound2 \
        fonts-liberation \
        libappindicator3-1 \
        lsb-release \
        xdg-utils

# Download and install Chrome
# Debian taken from https://www.ubuntuupdates.org/package/google_chrome/stable/main/base/google-chrome-stable
RUN curl --silent --show-error --fail http://dl.google.com/linux/chrome/deb/pool/main/g/google-chrome-stable/google-chrome-stable_88.0.4324.150-1_amd64.deb --output google-chrome.deb \
    && dpkg -i google-chrome.deb \
    && rm google-chrome.deb


# Install python
RUN apt-get install -y -q --no-install-recommends python

# Install pip
RUN set -x \
 && curl -OL https://bootstrap.pypa.io/pip/2.7/get-pip.py \
 && python get-pip.py \
 && rm get-pip.py

# Install AWS cli
RUN set -x \
 && pip install awscli

# Deploy deps
RUN apt-get install -y -q --no-install-recommends jq

# Node fsevents deps
RUN apt-get install -y -q --no-install-recommends g++ build-essential

# Webdriverio deps
RUN mkdir -p /usr/share/man/man1

RUN apt-get install -y -q --no-install-recommends default-jdk

RUN apt-get -y install git

RUN apt-get -y install procps

# DD agent
RUN DD_AGENT_MAJOR_VERSION=7 \
DD_SITE=$(aws ssm get-parameter --region us-east-1 --name ci.browser-sdk.dd_site --with-decryption --query "Parameter.Value" --out text) \
DD_API_KEY=$(aws ssm get-parameter --region us-east-1 --name ci.browser-sdk.dd_api_key --with-decryption --query "Parameter.Value" --out text) \
bash -c "$(curl -L https://s3.amazonaws.com/dd-agent/scripts/install_script.sh)"
