#!/bin/bash

# Check if development mode is requested
if [ "$1" = "dev" ]; then
    echo "Starting dashboard in DEVELOPMENT mode (with hot reload)..."
    echo "Changes to Dashboard.html will be reflected immediately without rebuilding"
    docker compose -f docker-compose.dev.yml up -d
    
    if [ $? -eq 0 ]; then
        echo "Dashboard started successfully in development mode!"
        echo "Dashboard is available at: http://localhost:9090"
        echo ""
        echo "Changes to Dashboard.html will be reflected immediately"
        echo "To stop the dashboard, run: docker compose -f docker-compose.dev.yml down"
        echo "To view logs, run: docker compose -f docker-compose.dev.yml logs -f"
    else
        echo "Failed to start dashboard in development mode"
        exit 1
    fi
else
    echo "Starting dashboard in PRODUCTION mode..."
    docker compose up -d --build
    
    if [ $? -eq 0 ]; then
        echo "Dashboard started successfully!"
        echo "Dashboard is available at: http://localhost:9090"
        echo ""
        echo "To stop the dashboard, run: docker compose down"
        echo "To view logs, run: docker compose logs -f"
        echo "To restart, run: docker compose restart"
        echo ""
        echo "For development with hot reload, run: ./run-docker.sh dev"
    else
        echo "Failed to start dashboard"
        exit 1
    fi
fi
