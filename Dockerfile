# 1. Use the official lightweight Node.js image
FROM node:18-alpine

# 2. Set working directory inside the container
WORKDIR /usr/src/app

# 3. Copy package files first (helps cache dependencies during builds)
COPY package*.json ./

# 4. Install production dependencies
RUN npm install --production

# 5. Copy the rest of your application code
COPY . .

# 6. Expose the port your server listens on (Render sets PORT dynamically)
EXPOSE 5000

# 7. Command to start your Express backend
CMD ["node", "server.js"]
