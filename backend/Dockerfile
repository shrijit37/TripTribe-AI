# Backend (Express API) — multi-stage production build.
FROM node:20.19.2 AS build

WORKDIR /app

# Install deps first for layer caching
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Clean install without devDependencies (nodemon removed at runtime)
FROM node:20.19.2 AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/index.js /app/index.js
COPY --from=build /app/config /app/config
COPY --from=build /app/controllers /app/controllers
COPY --from=build /app/middleware /app/middleware
COPY --from=build /app/models /app/models
COPY --from=build /app/routes /app/routes
COPY --from=build /app/utils /app/utils

EXPOSE 8080
USER node
CMD ["node", "index.js"]