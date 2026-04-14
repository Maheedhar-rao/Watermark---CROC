FROM node:20-alpine

LABEL org.opencontainers.image.description="Pathway Catalyst Watermark System v2 — proprietary. Contact tech@pathwaycatalyst.com."
LABEL org.opencontainers.image.source="https://github.com/Maheedhar-rao/Watermark---CROC"
LABEL org.opencontainers.image.licenses="Proprietary"

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ARG PCP_BUILD_ID=unknown
ENV PCP_IMAGE_TAG=latest
ENV PCP_BUILD_ID=${PCP_BUILD_ID}

EXPOSE 3000

CMD ["node", "server/server.js"]
