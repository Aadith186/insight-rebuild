FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev
FROM node:24-alpine
RUN apk add --no-cache ffmpeg
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY server ./server
COPY package.json ./
RUN mkdir -p /app/uploads && chown -R node:node /app
USER node
EXPOSE 4000
CMD ["node","server/src/server.js"]
