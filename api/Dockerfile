FROM node:22-alpine
WORKDIR /app

COPY api/package.json ./
RUN npm install

COPY api/tsconfig.json ./
COPY api/src ./src

ENV PORT=3000
EXPOSE 3000
CMD ["npx", "tsx", "src/index.ts"]
