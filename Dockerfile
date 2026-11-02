# Use official Node.js image
FROM node:18-alpine

# Set working directory inside the container
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy all source files
COPY . .

# Expose server port
EXPOSE 3000

# Start server
CMD ["node", "server.js"]
