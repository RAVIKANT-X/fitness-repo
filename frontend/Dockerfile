FROM node:20-alpine

WORKDIR /app

# Install dependencies first (layer caching)
COPY package.json ./
RUN npm install

# Source is volume-mounted in development; this copy is for production builds
COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev"]
