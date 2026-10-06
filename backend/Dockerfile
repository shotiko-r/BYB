FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN npm ci --workspace=@byb/shared --workspace=@byb/backend --include-workspace-root

FROM dependencies AS build
COPY shared ./shared
COPY backend ./backend
RUN npm run build --workspace=shared && npm run build --workspace=backend

FROM dependencies AS production-dependencies
RUN npm prune --omit=dev --workspace=@byb/shared --workspace=@byb/backend --include-workspace-root

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3001
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=production-dependencies --chown=node:node /app/backend ./backend
COPY --from=production-dependencies --chown=node:node /app/shared ./shared
COPY --from=build --chown=node:node /app/shared/dist ./shared/dist
COPY --from=build --chown=node:node /app/backend/dist ./backend/dist
USER node
EXPOSE 3001
CMD ["node", "backend/dist/index.js"]
