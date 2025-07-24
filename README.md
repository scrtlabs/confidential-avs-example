# Confidential AVS Example

---

This example shows how to build a Confidential AVS using Othentic and TEE-powered SecretVM.

Unlike traditional AVS, in Confidential AVS neither the Performer nor the Attester nodes can see the actual data. All the computations are peformed in TEEs by Performers, and the Attesters only verify that the Performer nodes are indeed running the expected code.

Besides the obvious benefit of protecting the user data, this architecture also radically simplifies the Attester node - now the Attester only needs to validate the cryptographic attestation of the Performer node and check the signature of the message to verify it originates from an authentic Performer.

This sample AVS performs KYC on documents supplied by the user. The document (e.g. passport) picture is first sent to a confidential AI model (running in a TEE) to extract the user's nationality and age.

Then, the Performer creates a message that contains the user's nationality, and two more Boolean fields: is_over_18 and is_over_21. During the execution, the user data never leaves the encrypted TEE environments and can not be observed either by the Performer node operators or by Attester node operators.

## Table of Contents

- [Confidential AVS Example](#confidential-avs-example)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [Project Structure](#project-structure)
  - [Architecture](#architecture)
  - [Prerequisites](#prerequisites)
  - [Usage](#usage)
  - [Service Start-up Order](#service-start-up-order)
    - [1. Start Aggregator](#1-start-aggregator)
    - [2. Start Attesters](#2-start-attesters)
    - [3. Start Validation Service](#3-start-validation-service)
    - [4. Start Execution Service](#4-start-execution-service)
    - [Troubleshooting](#troubleshooting)

---

## Overview

The Simple Price Oracle AVS Example demonstrates how to deploy a minimal AVS using Othentic Stack.


## Project Structure

```mdx
📂 confidential-avs-example
├── 📂 Execution_Service         # Implements Task execution logic - Express JS Backend
│   ├── 📂 config/
│   │   └── app.config.js        # An Express.js app setup with dotenv, and a task controller route for handling `/task` endpoints.
│   ├── 📂 src/
│   │   └── dal.service.js       # A module that interacts with Pinata for IPFS uploads
│   │   ├── task.controller.js   # An Express.js router handling a `/execute` POST endpoint
│   │   ├── 📂 utils             # Defines two custom classes, CustomResponse and CustomError, for standardizing API responses
│   ├── Dockerfile               # A Dockerfile that sets up a Node.js (22.6) environment, exposes port 8080, and runs the application via index.js
|   ├── index.js                 # A Node.js server entry point that initializes the DAL service, loads the app configuration, and starts the server on the specified port
│   └── package.json             # Node.js dependencies and scripts
│
├── 📂 Validation_Service         # Implements task validation logic - Express JS Backend
│   ├── 📂 config/
│   │   └── app.config.js         # An Express.js app setup with a task controller route for handling `/task` endpoints.
│   ├── 📂 src/
│   │   └── dal.service.js        # A module that interacts with Pinata for IPFS uploads

│   │   ├── task.controller.js    # An Express.js router handling a `/validate` POST endpoint
│   │   ├── verify.service.js  # A validation module that checks if a task result from IPFS matches the ETH/USDT price within a 5% margin.
│   │   ├── 📂 utils              # Defines two custom classes, CustomResponse and CustomError, for standardizing API responses.
│   ├── Dockerfile                # A Dockerfile that sets up a Node.js (22.6) environment, exposes port 8080, and runs the application via index.js.
|   ├── index.js                  # A Node.js server entry point that initializes the DAL service, loads the app configuration, and starts the server on the specified port.
│   └── package.json              # Node.js dependencies and scripts
│
├── 📂 grafana                    # Grafana monitoring configuration
├── docker-compose.yml            # Docker setup for Operator Nodes (Performer, Attesters, Aggregator), Execution Service, Validation Service, and monitoring tools
├── .env.example                  # An example .env file containing configuration details and contract addresses
├── README.md                     # Project documentation
└── prometheus.yaml               # Prometheus configuration for logs
```

## Architecture

The Confidential AVS example uses the following architecture:

<img width="15684" height="10067" alt="image" src="https://github.com/user-attachments/assets/ac99f540-bcdb-4cc7-bbe0-a1e1b6313b2e" />


The Performer node is deployed in a TEE-powered SecretVM ([secretai.scrtlabs.com/secret-vms](https://secretai.scrtlabs.com/secret-vms)).  
The ([attestation registers](https://docs.scrt.network/secret-network-documentation/secretvm-confidential-virtual-machines/attestation/attestation-report-key-fields)) identifying the Performer node should be known to the Atester nodes.

The Performer Node receives information from the end user (in this case, images representing the users' government-issued IDs). The Performer node then passes the images to an image-analysys LLM in order to retrieve information about the user's citizenship and age.

Once the image recognition is complete, Performer creates a  ([verifiably signed message](https://docs.scrt.network/secret-network-documentation/secretvm-confidential-virtual-machines/verifiable-message-signing)) contaning the user's nationality and two additional Boolean fields desribing the user's age:
- is_over_18
- is_over_21

The message and the Atestation Quote of the Performer Node is then passed to the P2P networking layers and can be verified by the Attesters

Attester nodes perform the following verification routine:
1. Verify the message
2. Verify the authenticity of the Attestation
3. Verify that the attestation registers match the expected value (meaning that the Performer Node code has not been tampered with)

---

## Prerequisites

- Node.js (v 22.6.0 )
- Foundry
- [Yarn](https://yarnpkg.com/)
- [Docker](https://docs.docker.com/engine/install/)

## Usage

1. Clone the repository:

   ```bash
   git clone https://github.com/Othentic-Labs/simple-price-oracle-avs-example.git
   cd simple-price-oracle-avs-example
   git checkout kyc-avs
   ```

2. Install Othentic CLI:

   ```bash
   npm i -g @othentic/cli
   npm i -g @othentic/node
   ```

3. Set up the TEE server by following the instructions below. Build the Docker image and start the server. Make sure to populate the `.env` file with `TEE_KYC_SERVER_URL` and any other required environment variables.
   ```bash
   cd ..
   git clone https://github.com/scrtlabs/kyc-avs-demo
   cd kyc-avs-demo
   docker build -t kyc-avs .
   ```

4. Follow the steps in the official documentation's [Quickstart](https://docs.othentic.xyz/main/welcome/getting-started/install-othentic-cli) Guide for setup and deployment.

   ```
   cd kyc-avs-demo
   docker compose build --no-cache
   docker compose up
   curl -X POST http://localhost:4003/task/execute
   ```

## Service Start-up Order

To ensure proper initialization and communication between services, start them in the following order:

### 1. Start Aggregator
```bash
docker compose -f docker-compose-aggregator.yml up -d
```

### 2. Start Attesters
```bash
for i in 1 2 3; do
  docker compose -f docker-compose-attester-$i.yml up -d
done
```

### 3. Start Validation Service
```bash
docker compose -f docker-compose-validation-service.yml up -d
```

### 4. Start Execution Service
```bash
docker compose -f docker-compose-execution-service.yml up -d
```

### Troubleshooting

If you encounter issues with service startup or communication:

1. **Check container logs** for detailed error messages:
   ```bash
   docker compose -f docker-compose-aggregator.yml logs
   docker compose -f docker-compose-attester-1.yml logs
   docker compose -f docker-compose-validation-service.yml logs
   docker compose -f docker-compose-execution-service.yml logs
   ```

2. **Verify network connectivity** between services:
   ```bash
   # Test connectivity to aggregator
   ping 10.8.0.1
   
   # Test connectivity to attesters
   ping 10.8.0.2
   ping 10.8.0.3
   ping 10.8.0.4
   
   # Test connectivity to validation service
   ping 10.8.0.5
   
   # Test connectivity to execution service
   ping 10.8.0.6
   ```

3. **Check service health** by monitoring container status:
   ```bash
   docker ps
   ```

4. **Restart services** if needed (in the same order as startup):
   ```bash
   docker compose -f docker-compose-aggregator.yml restart
   docker compose -f docker-compose-attester-1.yml restart
   docker compose -f docker-compose-attester-2.yml restart
   docker compose -f docker-compose-attester-3.yml restart
   docker compose -f docker-compose-validation-service.yml restart
   docker compose -f docker-compose-execution-service.yml restart
   ```

Happy Building! 🚀

