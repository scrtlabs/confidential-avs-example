FROM node:22.6

# Install git and configure it
RUN apt-get update && apt-get install -y git
RUN git config --global user.email "docker@build.local" && \
    git config --global user.name "Docker Build"

# Create app directory
WORKDIR /usr/src/app

# Copy application files and submodules
COPY . .

# Initialize and update submodules
RUN git init && \
    git config --global init.defaultBranch main && \
    git add . && \
    git commit -m "Temporary commit for Docker build" && \
    git submodule init && \
    git submodule update

# Build the SDK
WORKDIR /usr/src/app/sdk
RUN npm install && npm run build

# Install main application dependencies
WORKDIR /usr/src/app
RUN npm install

EXPOSE 8080
CMD [ "node", "index.js" ]
