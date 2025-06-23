FROM debian:bullseye-slim

WORKDIR /app

RUN apt-get update && \
    apt-get install -y \
        curl \
        unzip \
        ca-certificates \
        fonts-liberation \
        libappindicator3-1 \
        libasound2 \
        libatk-bridge2.0-0 \
        libatk1.0-0 \
        libcups2 \
        libdbus-1-3 \
        libgdk-pixbuf2.0-0 \
        libnspr4 \
        libnss3 \
        libx11-xcb1 \
        libxcomposite1 \
        libxdamage1 \
        libxrandr2 \
        xdg-utils \
        libgbm1 \
        libgtk-3-0 \
        libxshmfence1 \
        libgconf-2-4 \
        libglib2.0-0 \
        libglib2.0-bin \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash

ENV PATH="/root/.bun/bin:${PATH}"
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

COPY . .

RUN bun install

EXPOSE 3001

CMD ["bun", "index.js"]
