# Use nginx as the base image
FROM nginx:alpine

# Copy all necessary files to the nginx html directory
COPY Dashboard.html /usr/share/nginx/html/index.html
COPY dashboard.js /usr/share/nginx/html/dashboard.js
COPY styles.css /usr/share/nginx/html/styles.css

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
