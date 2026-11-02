FROM node:18-alpine

WORKDIR /app

# Copy package info first to leverage Docker layer caching
COPY package*.json ./

RUN npm install --production

# Copy remaining source code
COPY . .

# Default port for Render
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
