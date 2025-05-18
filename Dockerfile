FROM node:20-slim AS build

ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production

COPY . .

FROM node:20-slim

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app /app

EXPOSE 3000

CMD ["npm", "run", "start:chatbot"]
