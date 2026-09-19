# 🐳 SNIPPET — Docker Deployment & Containerization Guide

This project is fully containerized using a multi-stage Docker build that bundles the **Expo Web Frontend** and **FastAPI Python Backend** into a single, self-contained, production-ready container image.

---

## ⚡ Quick Start (1 Command)

### Option 1: Using Docker Compose (Recommended)

Make sure you have your secrets configured in `backend/.env` or `.env`.

```bash
# Build and run the container in the background
docker compose up --build -d

# View live application logs
docker compose logs -f app
```

Open **`http://localhost:8000`** in your browser!

To stop the container:
```bash
docker compose down
```

---

### Option 2: Using Plain Docker CLI

```bash
# 1. Build the image
docker build -t snippet-app .

# 2. Run the container with your env file
docker run -d \
  --name snippet-app \
  -p 8000:8000 \
  --env-file backend/.env \
  snippet-app

# 3. View logs
docker logs -f snippet-app
```

---

### Option 3: Offline / Local MongoDB Mode

If you don't want to use MongoDB Atlas in the cloud and prefer a completely self-hosted local database:

```bash
docker compose --profile local-db up --build -d
```

This will start both:
1. `snippet-mongo`: Local MongoDB 7.0 database on port `27017` with persistent volume `snippet_mongo_data`.
2. `snippet-app`: The full-stack application.

---

## ☁️ Deploying on Cloud Providers

Because this container is standard OCI-compliant and listens dynamically on `$PORT`, you can deploy it on any cloud:

### 1. AWS App Runner (Fastest Container Deployment on AWS)
1. Push this image to **Amazon ECR** (Elastic Container Registry) or connect your GitHub repository directly.
2. In AWS App Runner Console:
   - Source: Container image or Source code repository
   - Port: `8000`
   - Add your environment variables in the App Runner dashboard.
   - Click **Deploy** -> AWS gives you a live HTTPS URL in ~3 minutes!

### 2. AWS EC2 with Docker
If you're using an EC2 instance:
```bash
# Install Docker on Ubuntu EC2
sudo apt-get update && sudo apt-get install -y docker.io docker-compose-v2
sudo usermod -aG docker ubuntu

# Clone and run
git clone https://github.com/CodeNova-Ayush/AWS-Project.git
cd AWS-Project
docker compose up --build -d
```

### 3. AWS ECS / Fargate
Use the included `Dockerfile` as your ECS Task Definition container. Set container port to `8000`.

---

## 🔍 Verification & Health Checks

The container includes a built-in health check on `/health`:

```bash
# Check container status & health
docker ps

# Test health check endpoint directly
curl http://localhost:8000/health
# Response: {"status":"ok","service":"snippet-backend"}

# Test frontend static serving
curl -I http://localhost:8000/
# Response: HTTP/1.1 200 OK
```

---

## 🛠️ Useful Docker Commands

| Action | Command |
|:---|:---|
| Rebuild without cache | `docker compose build --no-cache` |
| View real-time logs | `docker compose logs -f` |
| Execute shell inside container | `docker exec -it snippet-app /bin/bash` |
| Check resource usage | `docker stats snippet-app` |
| Stop and remove container | `docker compose down` |
