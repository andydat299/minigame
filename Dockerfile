FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm i --omit=dev
COPY . .
CMD ["npm","start"]
