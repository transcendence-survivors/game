FROM node:20-alpine

WORKDIR /app

RUN npm install -g pnpm
RUN pnpm config set store-dir /pnpm/store

COPY package.json pnpm-lock.yaml ./

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install

COPY . .

EXPOSE 5173

CMD ["pnpm", "run dev"]