# Dashboard Docker Setup

This project contains a Docker Compose setup to serve the HTML dashboard as a web application.

## Files

- `Dashboard.html` - The main HTML dashboard application
- `Dockerfile` - Docker configuration to serve the HTML file
- `docker-compose.yml` - Docker Compose configuration
- `.dockerignore` - Files to exclude from Docker build context
- `run-docker.sh` - Script to build and run the Docker services

## Quick Start

### Option 1: Using the provided script (Recommended)

```bash
./run-docker.sh
```

This will:
1. Build the Docker image using Docker Compose
2. Start the service on port 8080
3. Display the URL to access the dashboard

### Option 2: Using Docker Compose directly

1. Start the dashboard:
```bash
docker-compose up -d --build
```

2. Access the dashboard at: http://localhost:8080

### Option 3: Manual Docker commands

1. Build the Docker image:
```bash
docker build -t dashboard-app .
```

2. Run the container:
```bash
docker run -d -p 8080:80 --name dashboard-container dashboard-app
```

## Managing the Services

### Stop the dashboard:
```bash
docker-compose down
```

### View logs:
```bash
docker-compose logs -f
```

### Restart the dashboard:
```bash
docker-compose restart
```

### Rebuild and restart:
```bash
docker-compose up -d --build
```

### Stop and remove everything:
```bash
docker-compose down --rmi all
```

## Features

The dashboard includes:
- Interactive 8K candlestick charts
- Multiple chart types (candlestick, scatter, line, histogram)
- CSV data input and sample data generation
- ML cluster analysis visualization
- Real-time filtering and controls
- Responsive design with modern UI

## Docker Compose Benefits

Using Docker Compose provides several advantages:

- **Simplified Management**: Single command to start/stop all services
- **Configuration as Code**: All settings defined in `docker-compose.yml`
- **Easy Scaling**: Can easily add more services or scale existing ones
- **Environment Management**: Easy to switch between development and production
- **Service Dependencies**: Can define relationships between services
- **Volume Management**: Easy to manage persistent data

## Port Configuration

The container runs on port 80 internally and maps to port 8080 on your host machine. You can change the port mapping by modifying the `ports` section in `docker-compose.yml`:

```yaml
ports:
  - "3000:80"  # This would make it available at http://localhost:3000
```

Or using Docker run command:

```bash
docker run -d -p 3000:80 --name dashboard-container dashboard-app
```
