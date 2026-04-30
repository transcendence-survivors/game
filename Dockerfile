FROM node:20-alpine

RUN npm install -g pnpm

WORKDIR /app

COPY shared-package/ ./shared-package/
COPY client/ ./client/

WORKDIR /app/client

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install

EXPOSE 5173

CMD ["pnpm", "dev", "--host", "0.0.0.0"]