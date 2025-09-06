#!/bin/bash

# Start the dashboard using Docker Compose
echo "Starting dashboard with Docker Compose..."
docker compose up -d --build

# Check if the service started successfully
if [ $? -eq 0 ]; then
    echo "Dashboard started successfully!"
    echo "Dashboard is available at: http://localhost:8080"
    echo ""
    echo "To stop the dashboard, run: docker compose down"
    echo "To view logs, run: docker compose logs -f"
    echo "To restart, run: docker compose restart"
else
    echo "Failed to start dashboard"
    exit 1
fi
