# Frontend (Vite React) — multi-stage production build served by nginx.
# Built on GH Actions, never on the server. Node 24 = Active LTS (Oct 2026).
FROM node:24-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# VITE_* values are baked into the bundle at build time (Vite static
# replacement). CI passes real values from Infisical; empty defaults keep
# the build green and the app boots degraded (see FirebaseConfig.js).
ARG VITE_AUTH_API_URL=/api/users
ARG VITE_ITENARY_API_URL=/api/itenary
ARG VITE_GOOGLE_PLACES_API_KEY=
ARG VITE_FIREBASE_API_KEY=
ARG VITE_FIREBASE_AUTH_DOMAIN=
ARG VITE_FIREBASE_PROJECT_ID=
ARG VITE_FIREBASE_STORAGE_BUCKET=
ARG VITE_FIREBASE_MESSAGING_SENDER_ID=
ARG VITE_FIREBASE_APP_ID=
ARG VITE_FIREBASE_MEASUREMENT_ID=
ARG VITE_EMAIL_VERIFICATION_API_URL=

RUN npm run build

FROM nginx:1.27-alpine AS runtime

# Backend base + image version are baked into nginx.conf at build time
# (rewrites/proxy targets are build-time, not runtime — same rule as
# Next.js rewrites). CI passes the public API URL; the default serves
# local docker compose (backend:8080).
ARG BACKEND_URL=http://backend:8080
ARG APP_VERSION=unknown

# Custom nginx config: serve SPA, proxy /api to backend service
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
RUN sed -i "s|__BACKEND_URL__|${BACKEND_URL}|g; s|__APP_VERSION__|${APP_VERSION}|g" \
  /etc/nginx/conf.d/default.conf \
  && ! grep -q "__BACKEND_URL__\|__APP_VERSION__" /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
