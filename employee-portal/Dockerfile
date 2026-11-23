FROM node:16-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY employee-portal ./employee-portal

CMD ["node", "employee-portal/server.js"]
