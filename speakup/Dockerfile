FROM node:20-alpine
WORKDIR /app
COPY package.json server.mjs index.html styles.css manifest.webmanifest sw.js ./
COPY js ./js
COPY icons ./icons
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.mjs"]
