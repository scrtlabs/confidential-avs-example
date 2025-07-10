FROM node:22.6

# Install git
RUN apt-get update && apt-get install -y git

# Create app directory
WORKDIR /usr/src/app

# Copy application files first
COPY . .

# Remove any existing sdk directory and clone the SDK
RUN rm -rf sdk && git clone https://github.com/scrtlabs/secret-ai-sdk-js.git sdk

# Build the SDK
WORKDIR /usr/src/app/sdk
RUN npm install && npm run build

# Install main application dependencies
WORKDIR /usr/src/app
RUN npm install

EXPOSE 8080
CMD [ "node", "index.js" ]
