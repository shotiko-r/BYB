FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
RUN npm ci --workspace=@byb/shared --workspace=@byb/frontend --include-workspace-root

FROM dependencies AS build
COPY shared ./shared
COPY frontend ./frontend
ARG NEXT_PUBLIC_API_URL
ENV NODE_ENV=production NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace=shared && npm run build --workspace=frontend

FROM dependencies AS production-dependencies
RUN npm prune --omit=dev --workspace=@byb/shared --workspace=@byb/frontend --include-workspace-root

FROM node:22-alpine AS runtime
WORKDIR /app
ARG NEXT_PUBLIC_API_URL
ENV NODE_ENV=production PORT=3000 NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL NEXT_TELEMETRY_DISABLED=1
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=production-dependencies --chown=node:node /app/frontend ./frontend
COPY --from=production-dependencies --chown=node:node /app/shared ./shared
COPY --from=build --chown=node:node /app/shared/dist ./shared/dist
COPY --from=build --chown=node:node /app/frontend/.next ./frontend/.next
COPY --from=build --chown=node:node /app/frontend/public ./frontend/public
COPY --from=build --chown=node:node /app/frontend/next.config.js /app/frontend/api-config.cjs ./frontend/
WORKDIR /app/frontend
USER node
EXPOSE 3000
CMD ["node", "../node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0"]
