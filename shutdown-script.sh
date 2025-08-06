#!/bin/bash

# YouTube Download VM Shutdown Script
# This script runs when the VM shuts down

echo "Cleaning up YouTube Download VM..."

# Stop the service gracefully
if systemctl is-active --quiet ytapp; then
    echo "Stopping ytapp service..."
    systemctl stop ytapp
fi

# Clean up any temporary files in /tmp that might be from our app
echo "Cleaning up temporary files..."
find /tmp -name "*.mp4" -mtime +1 -delete 2>/dev/null || true

# Clean up any orphaned temporary files in /opt/ytapp
if [ -d "/opt/ytapp" ]; then
    find /opt/ytapp -name "*.mp4" -delete 2>/dev/null || true
fi

echo "YouTube Download VM cleanup completed." 