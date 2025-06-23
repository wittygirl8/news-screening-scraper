FROM debian:bullseye-slim

WORKDIR /app

# Install curl, unzip, and CA certs
RUN apt-get update && \
    apt-get install -y curl unzip ca-certificates && \
    update-ca-certificates && \
    apt-get clean

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash

# Add Bun to PATH
ENV PATH="/root/.bun/bin:${PATH}"

# Optionally disable SSL verification (only if needed)
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

# Copy app files
COPY . .

# Install deps
RUN bun install

EXPOSE 3001

CMD ["bun", "index.js"]
