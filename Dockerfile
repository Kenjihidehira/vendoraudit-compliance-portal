FROM node:24-alpine

WORKDIR /app
COPY package.json ./
COPY src ./src
COPY public ./public
COPY data ./data

ENV NODE_ENV=production
ENV PORT=4182
EXPOSE 4182

CMD ["node", "src/server.js"]
