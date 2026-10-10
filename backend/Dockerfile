# Backend (Express API) — multi-stage production build.
# Built on GH Actions, never on the server. Node 24 = Active LTS (Oct 2026).
FROM node:24-bookworm-slim AS build

WORKDIR /app
ARG APP_VERSION=unknown
ENV APP_VERSION=$APP_VERSION

# Install deps first for layer caching
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Clean install without devDependencies (nodemon removed at runtime)
FROM node:24-bookworm-slim AS runtime

WORKDIR /app
ARG APP_VERSION=unknown
ENV APP_VERSION=$APP_VERSION
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/index.js /app/index.js
COPY --from=build /app/config /app/config
COPY --from=build /app/controllers /app/controllers
COPY --from=build /app/middleware /app/middleware
COPY --from=build /app/models /app/models
COPY --from=build /app/routes /app/routes

EXPOSE 8080
USER node
CMD ["node", "index.js"]