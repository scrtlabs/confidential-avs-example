FROM node:22.6

RUN npm install -g npm@10.5.0

# Install git and configure it
RUN apt-get update && apt-get install -y git
RUN git config --global user.email "docker@build.local" && \
    git config --global user.name "Docker Build"

WORKDIR /app

# Copy only the files needed for dependency installation first
COPY package*.json ./
COPY .gitmodules ./

# Copy the rest of the application
COPY . .

# Initialize and update git submodules
RUN git submodule init && \
    git submodule update

# Install dependencies and build the SDK
RUN cd Execution_Service/sdk && npm install && npm run build

# Install dependencies for the main application
RUN cd Execution_Service && npm install

RUN npm i -g @othentic/cli
RUN npm i -g @othentic/node

ENTRYPOINT [ "otnode" ]
