FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
COPY packages/shared/package.json packages/shared/
RUN bun install --frozen-lockfile

FROM deps AS build
COPY . .
WORKDIR /app/packages/client
RUN bun node_modules/.bin/vite build
WORKDIR /app

FROM oven/bun:1-slim AS production
WORKDIR /app

COPY package.json bun.lock ./
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
COPY packages/shared/package.json packages/shared/
RUN bun install --frozen-lockfile

COPY --from=build /app/packages/client/dist ./packages/client/dist
COPY packages/server ./packages/server
COPY packages/shared ./packages/shared

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/student-assist.db
EXPOSE 3000

CMD ["bun", "packages/server/src/index.ts"]
