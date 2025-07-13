# Production Deployment Guide

This guide explains how to deploy the services on separate machines using the individual docker-compose files.

## Services Overview

The original monolithic docker-compose.yml has been split into separate files for production deployment:

- `docker-compose-aggregator.yml` - Aggregator service
- `docker-compose-attester.yml` - Attester service (generic for all attesters)
- `docker-compose-validation-service.yml` - Validation service
- `docker-compose-execution-service.yml` - Execution service

## Service Dependencies

```
┌─────────────────┐    ┌─────────────────┐
│   Attesters     │───▶│   Aggregator    │
│  (1, 2, 3)      │    │                 │
└─────────────────┘    └─────────────────┘
          │                       ▲
          │                       │
          ▼                       │
┌─────────────────┐    ┌─────────────────┐
│   Validation    │    │   Execution     │
│   Service       │    │   Service       │
└─────────────────┘    └─────────────────┘
```

## Machine Requirements

### Aggregator Service (Machine 1)
- **Exposed Ports**: 8545, 9876
- **Docker Compose**: `docker-compose-aggregator.yml`
- **Environment Variables**:
  - `PRIVATE_KEY_AGGREGATOR`
  - `L1_CHAIN`
  - `L2_CHAIN`
  - `OTHENTIC_BOOTSTRAP_ID`

### Validation Service (Machine 2)
- **Exposed Ports**: 4002
- **Docker Compose**: `docker-compose-validation-service.yml`
- **Environment Variables**:
  - `VALIDATION_SERVICE_PORT` (optional, defaults to 4002)

### Attester Services (Machines 3, 4, 5)
- **Docker Compose**: `docker-compose-attester.yml`
- **Environment Variables**:
  - `PRIVATE_KEY_ATTESTER` (different for each attester)
  - `L1_CHAIN`
  - `L2_CHAIN`
  - `OTHENTIC_BOOTSTRAP_ID`
  - `AGGREGATOR_HOST` (IP of aggregator machine)
  - `VALIDATION_SERVICE_HOST` (IP of validation service machine)
  - `VALIDATION_SERVICE_PORT` (optional, defaults to 4002)

### Execution Service (Machine 6)
- **Exposed Ports**: 4003
- **Docker Compose**: `docker-compose-execution-service.yml`
- **Environment Variables**:
  - `PRIVATE_KEY_PERFORMER`
  - `SECRET_AI_API_KEY`
  - `AGGREGATOR_HOST` (IP of aggregator machine)

## Deployment Steps

### 1. Deploy Aggregator Service
```bash
# On aggregator machine (e.g., 192.168.1.100)
cp .env .env.aggregator
# Edit .env.aggregator with aggregator-specific values
docker-compose -f docker-compose-aggregator.yml --env-file .env.aggregator up -d
```

### 2. Deploy Validation Service
```bash
# On validation service machine (e.g., 192.168.1.102)
cp .env .env.validation
# Edit .env.validation with validation-specific values
docker-compose -f docker-compose-validation-service.yml --env-file .env.validation up -d
```

### 3. Deploy Attester Services
```bash
# On each attester machine (e.g., 192.168.1.103, 192.168.1.104, 192.168.1.105)

# Create environment file for this attester
cp .env .env.attester
# Edit .env.attester with:
# - Unique PRIVATE_KEY_ATTESTER for each attester
# - AGGREGATOR_HOST=192.168.1.100
# - VALIDATION_SERVICE_HOST=192.168.1.102

docker-compose -f docker-compose-attester.yml --env-file .env.attester up -d
```

### 4. Deploy Execution Service
```bash
# On execution service machine (e.g., 192.168.1.106)
cp .env .env.execution
# Edit .env.execution with:
# - AGGREGATOR_HOST=192.168.1.100
# - PRIVATE_KEY_PERFORMER
# - SECRET_AI_API_KEY

docker-compose -f docker-compose-execution-service.yml --env-file .env.execution up -d
```

## Environment Variable Examples

### Aggregator (.env.aggregator)
```
PRIVATE_KEY_AGGREGATOR=0x1234567890abcdef...
L1_CHAIN=ethereum
L2_CHAIN=polygon
OTHENTIC_BOOTSTRAP_ID=12D3KooW...
```

### Attester (.env.attester)
```
PRIVATE_KEY_ATTESTER=0xabcdef1234567890...
L1_CHAIN=ethereum
L2_CHAIN=polygon
OTHENTIC_BOOTSTRAP_ID=12D3KooW...
AGGREGATOR_HOST=192.168.1.100
VALIDATION_SERVICE_HOST=192.168.1.102
VALIDATION_SERVICE_PORT=4002
```

### Validation Service (.env.validation)
```
VALIDATION_SERVICE_PORT=4002
```

### Execution Service (.env.execution)
```
PRIVATE_KEY_PERFORMER=0xfedcba0987654321...
SECRET_AI_API_KEY=sk-...
AGGREGATOR_HOST=192.168.1.100
```

## Network Configuration

Make sure the following ports are accessible between machines:

- **Aggregator**: Ports 8545 and 9876 must be accessible to attesters and execution service
- **Validation Service**: Port 4002 must be accessible to attesters
- **Execution Service**: Port 4003 (if external access needed)

## Monitoring

You can monitor each service individually:

```bash
# Check logs
docker-compose -f docker-compose-{service}.yml logs -f

# Check status
docker-compose -f docker-compose-{service}.yml ps
```

## Scaling

To add more attesters, simply deploy additional attester instances on new machines using the same `docker-compose-attester.yml` file with unique private keys. 