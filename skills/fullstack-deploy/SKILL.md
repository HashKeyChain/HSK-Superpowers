---
name: fullstack-deploy
description: "Use when deploying frontend, backend, or indexer services — covers Docker multi-stage builds, K8s manifests, GitHub Actions CI/CD, and environment management for HashKey Chain L2"
---

# Full-Stack Deployment

Guide deployment of dApp frontend (Next.js), Go backend, and indexer services for HashKey Chain L2 using Docker + K8s + GitHub Actions.

**Announce at start:** "I'm using the fullstack-deploy skill for Docker, K8s, and CI/CD deployment."

**Coordination:** This skill covers application deployment. For contract deployment (Anvil → Testnet → Mainnet), use the `hsk-superpowers:l2-deployment` skill.

## When to Use

- Dockerizing frontend, backend, or indexer services
- Writing K8s deployment manifests
- Setting up GitHub Actions CI/CD pipelines
- Managing environment configs across localhost / testnet / mainnet

## Environment Management

Three environments, each with its own chain config:

| Environment | Chain ID | RPC | Use |
|-------------|----------|-----|-----|
| localhost | 31337 | http://127.0.0.1:8545 (anvil) | Local development |
| testnet | 133 | https://testnet.hsk.xyz | Staging / QA |
| mainnet | 177 | https://mainnet.hsk.xyz | Production |

### Frontend Environment Variables

```bash
# .env.local (localhost)
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545
NEXT_PUBLIC_CONTRACT_MYTOKEN=0x5FbDB2315678afecb367f032d93F642f64180aa3

# .env.testnet
NEXT_PUBLIC_CHAIN_ID=133
NEXT_PUBLIC_RPC_URL=https://testnet.hsk.xyz
NEXT_PUBLIC_CONTRACT_MYTOKEN=0x...

# .env.mainnet
NEXT_PUBLIC_CHAIN_ID=177
NEXT_PUBLIC_RPC_URL=https://mainnet.hsk.xyz
NEXT_PUBLIC_CONTRACT_MYTOKEN=0x...
```

### Backend Environment Variables

```bash
RPC_URL=https://testnet.hsk.xyz
WSS_URL=wss://testnet-ws.hsk.xyz
CHAIN_ID=133
DB_URL=postgres://user:pass@db:5432/indexer
REDIS_URL=redis://redis:6379
CONTRACT_MYTOKEN=0x...
```

NEVER commit private keys or API secrets. Use K8s Secrets or a secrets manager.

## Docker Builds

### Next.js Frontend

```dockerfile
# Dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production=false

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_CHAIN_ID
ARG NEXT_PUBLIC_RPC_URL
ARG NEXT_PUBLIC_CONTRACT_MYTOKEN
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

Requires `next.config.js`:

```javascript
module.exports = {
  output: 'standalone',
}
```

### Go Backend

```dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /server ./cmd/server

FROM alpine:3.19
RUN apk add --no-cache ca-certificates
COPY --from=builder /server /server
EXPOSE 8080
CMD ["/server"]
```

### Build & Push

```bash
# Build with build args for chain config
docker build --build-arg NEXT_PUBLIC_CHAIN_ID=133 \
             --build-arg NEXT_PUBLIC_RPC_URL=https://testnet.hsk.xyz \
             -t registry.internal/frontend:v1.0.0 .

docker push registry.internal/frontend:v1.0.0
```

## K8s Deployment

### ConfigMap for Chain Configuration

```yaml
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: chain-config
  namespace: dapp
data:
  CHAIN_ID: "133"
  RPC_URL: "https://testnet.hsk.xyz"
  WSS_URL: "wss://testnet-ws.hsk.xyz"
  CONTRACT_MYTOKEN: "0x..."
```

### Secret for Sensitive Values

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: dapp-secrets
  namespace: dapp
type: Opaque
stringData:
  DB_URL: "postgres://user:pass@db:5432/indexer"
  REDIS_URL: "redis://redis:6379"
```

### Frontend Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: dapp
spec:
  replicas: 2
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
        - name: frontend
          image: registry.internal/frontend:v1.0.0
          ports:
            - containerPort: 3000
          resources:
            requests:
              memory: "256Mi"
              cpu: "200m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          readinessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: frontend
  namespace: dapp
spec:
  selector:
    app: frontend
  ports:
    - port: 80
      targetPort: 3000
```

### Backend Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: dapp
spec:
  replicas: 2
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
        - name: backend
          image: registry.internal/backend:v1.0.0
          ports:
            - containerPort: 8080
          envFrom:
            - configMapRef:
                name: chain-config
            - secretRef:
                name: dapp-secrets
          resources:
            requests:
              memory: "128Mi"
              cpu: "100m"
            limits:
              memory: "256Mi"
              cpu: "500m"
          readinessProbe:
            httpGet:
              path: /health
              port: 8080
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 10
```

## GitHub Actions CI/CD

### Frontend Pipeline

```yaml
# .github/workflows/frontend.yml
name: Frontend CI/CD

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit
      - run: npm test

  build-and-push:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ${{ secrets.REGISTRY_URL }}
          username: ${{ secrets.REGISTRY_USER }}
          password: ${{ secrets.REGISTRY_PASS }}
      - uses: docker/build-push-action@v5
        with:
          push: true
          tags: ${{ secrets.REGISTRY_URL }}/frontend:${{ github.sha }}
          build-args: |
            NEXT_PUBLIC_CHAIN_ID=133
            NEXT_PUBLIC_RPC_URL=https://testnet.hsk.xyz
```

### Backend Pipeline

```yaml
# .github/workflows/backend.yml
name: Backend CI/CD

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with: { go-version: '1.22' }
      - run: go vet ./...
      - run: go test -short ./...

  build-and-push:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ${{ secrets.REGISTRY_URL }}
          username: ${{ secrets.REGISTRY_USER }}
          password: ${{ secrets.REGISTRY_PASS }}
      - uses: docker/build-push-action@v5
        with:
          push: true
          tags: ${{ secrets.REGISTRY_URL }}/backend:${{ github.sha }}
```

## Deployment Sequence

For a full stack release:

```
1. Deploy contracts (`hsk-superpowers:l2-deployment`: Anvil → Testnet → Mainnet)
2. Export ABI (`hsk-superpowers:abi-sync`)
3. Update frontend contract addresses → build → push → deploy
4. Update backend contract addresses → build → push → deploy
5. Deploy/update Subgraph (if events changed)
6. Smoke test: verify one end-to-end transaction on testnet
7. Promote to mainnet (repeat 3-5 with mainnet config)
```

## Integration

**Related skills (auto-triggered by context):**
- `hsk-superpowers:l2-deployment` — Contract deployment (Anvil -> Testnet -> Mainnet) precedes app deployment
- `hsk-superpowers:abi-sync` — ABI export step runs between contract deploy and app build
- `hsk-superpowers:fullstack-testing` — All tests must pass before deployment
- `hsk-superpowers:verification-before-completion` — Verify builds and deployments before claiming done
- `hsk-superpowers:project-scaffold` — Initial Dockerfile and CI/CD templates

## Checklist

- [ ] Docker images use multi-stage builds (small final image)
- [ ] Next.js uses `output: 'standalone'` for Docker
- [ ] Go binary is statically compiled (`CGO_ENABLED=0`)
- [ ] No secrets in Docker images or environment files committed to git
- [ ] K8s manifests have resource limits, readiness/liveness probes
- [ ] Chain config managed via ConfigMap (easy to switch testnet/mainnet)
- [ ] CI runs lint + type-check + tests before build
- [ ] Docker images tagged with git SHA (not just `latest`)
- [ ] Deployment sequence follows: contracts → ABI → frontend → backend → indexer
