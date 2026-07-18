FROM node:20-alpine

ENV NODE_ENV=production
ENV TZ=UTC
ENV DATA_DIR=/data
ENV PORT=8080

WORKDIR /app

# Install production deps first (better layer caching)
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# App source (static assets + server + shared engine)
COPY server.js engine.js index.html app.js sw.js manifest.webmanifest icon-192.png icon-512.png ./

EXPOSE 8080
VOLUME ["/data"]
CMD ["node", "server.js"]
