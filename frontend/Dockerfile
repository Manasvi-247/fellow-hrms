FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.30-alpine
USER root
# CI passes a new value on every run so security updates are never served from the build cache.
ARG APK_REFRESH=manual
RUN echo "apk refresh: ${APK_REFRESH}" && apk upgrade --no-cache
USER 101
ENV BACKEND_HOST=backend BACKEND_PORT=8000
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
