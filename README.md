# Dashboard Docker Setup

This project contains a Docker Compose setup to serve the HTML dashboard as a web application.

## Files

- `Dashboard.html` - The main HTML dashboard application
- `Dockerfile` - Docker configuration to serve the HTML file
- `docker-compose.yml` - Docker Compose configuration
- `.dockerignore` - Files to exclude from Docker build context
- `run-docker.sh` - Script to build and run the Docker services

## Quick Start

### Option 1: Development Mode (Recommended for development)

```bash
./run-docker.sh dev
```

This will:
1. Start the dashboard with hot reload enabled
2. Changes to `Dashboard.html` are reflected immediately without rebuilding
3. Perfect for development and testing

### Option 2: Production Mode

```bash
./run-docker.sh
```

This will:
1. Build the Docker image using Docker Compose
2. Start the service on port 9090
3. Optimized for production deployment

### Option 3: Using Docker Compose directly

**Development (with hot reload):**
```bash
docker compose -f docker-compose.dev.yml up -d
```

**Production:**
```bash
docker compose up -d --build
```

Access the dashboard at: http://localhost:9090

### Option 4: Manual Docker commands

1. Build the Docker image:
```bash
docker build -t dashboard-app .
```

2. Run the container:
```bash
docker run -d -p 9090:80 --name dashboard-container dashboard-app
```

## Development Workflow

### For Development (Hot Reload)
1. Start in development mode:
   ```bash
   ./run-docker.sh dev
   ```

2. Edit `Dashboard.html` - changes are reflected immediately
3. Refresh your browser to see changes
4. No need to rebuild or restart the container

### For Production
1. Start in production mode:
   ```bash
   ./run-docker.sh
   ```

2. Changes require rebuilding:
   ```bash
   docker compose up -d --build
   ```

## Managing the Services

### Stop the dashboard:
```bash
# Development mode
docker compose -f docker-compose.dev.yml down

# Production mode
docker compose down
```

### View logs:
```bash
# Development mode
docker compose -f docker-compose.dev.yml logs -f

# Production mode
docker compose logs -f
```

### Restart the dashboard:
```bash
# Development mode
docker compose -f docker-compose.dev.yml restart

# Production mode
docker compose restart
```

### Rebuild and restart (Production only):
```bash
docker compose up -d --build
```

### Stop and remove everything:
```bash
# Development mode
docker compose -f docker-compose.dev.yml down --rmi all

# Production mode
docker compose down --rmi all
```

## Features

The dashboard includes:
- Interactive 8K candlestick charts
- Multiple chart types (candlestick, scatter, line, histogram)
- CSV data input and sample data generation
- ML cluster analysis visualization
- Real-time filtering and controls
- **Bullish/Bearish candle filtering** - Filter by candle type
- **Enhanced statistics** - Shows bullish, bearish, and doji candle counts
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

The container runs on port 80 internally and maps to port 9090 on your host machine. You can change the port mapping by modifying the `ports` section in `docker-compose.yml`:

```yaml
ports:
  - "3000:80"  # This would make it available at http://localhost:3000
```

Or using Docker run command:

```bash
docker run -d -p 3000:80 --name dashboard-container dashboard-app
```
