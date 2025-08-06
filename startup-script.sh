#!/bin/bash

# YouTube Download VM Startup Script
# This script runs automatically when the VM boots up

set -e  # Exit on any error

echo "Starting YouTube Download VM setup..."

# Update system and install dependencies
echo "Updating system packages..."
apt update -y

echo "Installing Python, pip, venv, and ffmpeg..."
apt install -y python3 python3-pip python3-venv ffmpeg

# Create application directory
echo "Creating application directory..."
mkdir -p /opt/ytapp
cd /opt/ytapp

# Create the Flask application
echo "Creating Flask application..."
cat > /opt/ytapp/app.py << 'EOF'
#!/usr/bin/env python3
"""
YouTube Download Flask App
Provides a simple API to download YouTube videos using yt-dlp
"""

import os
import tempfile
import logging
from flask import Flask, request, send_file, jsonify
import yt_dlp
import threading
import time

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Global variable to track active downloads
active_downloads = {}
download_lock = threading.Lock()

def cleanup_temp_file(file_path):
    """Safely remove temporary file"""
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
            logger.info(f"Cleaned up temporary file: {file_path}")
    except Exception as e:
        logger.error(f"Error cleaning up {file_path}: {e}")

def download_video(url, use_cookies=False):
    """Download video using yt-dlp"""
    temp_file = None
    try:
        # Create temporary file
        temp_fd, temp_file = tempfile.mkstemp(suffix='.mp4')
        os.close(temp_fd)
        
        # yt-dlp options
        ydl_opts = {
            'format': 'best[ext=mp4]/best',  # Prefer MP4, fallback to best
            'outtmpl': temp_file,
            'quiet': True,
            'no_warnings': True,
        }
        
        # Add cookies if requested and available
        if use_cookies:
            cookies_file = '/opt/ytapp/youtube_cookies.txt'
            if os.path.exists(cookies_file):
                ydl_opts['cookiefile'] = cookies_file
                logger.info("Using cookies file for download")
            else:
                logger.warning("Cookies requested but file not found")
        
        # Download the video
        logger.info(f"Starting download: {url}")
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            
        if not os.path.exists(temp_file) or os.path.getsize(temp_file) == 0:
            raise Exception("Download failed - file is empty or doesn't exist")
            
        logger.info(f"Download completed: {temp_file}")
        return temp_file, info.get('title', 'Unknown Title')
        
    except Exception as e:
        if temp_file and os.path.exists(temp_file):
            cleanup_temp_file(temp_file)
        raise e

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'youtube-download',
        'timestamp': time.time()
    })

@app.route('/download', methods=['GET'])
def download():
    """Download YouTube video endpoint"""
    url = request.args.get('url')
    use_cookies = request.args.get('use_cookies', 'false').lower() == 'true'
    
    if not url:
        return jsonify({'error': 'URL parameter is required'}), 400
    
    # Validate URL (basic check)
    if 'youtube.com' not in url and 'youtu.be' not in url:
        return jsonify({'error': 'Only YouTube URLs are supported'}), 400
    
    # Check if download is already in progress
    with download_lock:
        if url in active_downloads:
            return jsonify({'error': 'Download already in progress for this URL'}), 409
        active_downloads[url] = True
    
    temp_file = None
    try:
        # Download the video
        temp_file, title = download_video(url, use_cookies)
        
        # Send the file
        response = send_file(
            temp_file,
            as_attachment=True,
            download_name=f"{title[:50]}.mp4",  # Limit filename length
            mimetype='video/mp4'
        )
        
        # Add cleanup callback
        @response.call_on_close
        def cleanup():
            cleanup_temp_file(temp_file)
            with download_lock:
                active_downloads.pop(url, None)
        
        return response
        
    except Exception as e:
        # Clean up on error
        if temp_file:
            cleanup_temp_file(temp_file)
        with download_lock:
            active_downloads.pop(url, None)
        
        logger.error(f"Download error: {str(e)}")
        return jsonify({'error': f'Download failed: {str(e)}'}), 500

@app.route('/status', methods=['GET'])
def status():
    """Get current download status"""
    with download_lock:
        active_count = len(active_downloads)
    
    return jsonify({
        'active_downloads': active_count,
        'active_urls': list(active_downloads.keys())
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=False)
EOF

# Create requirements.txt
echo "Creating requirements.txt..."
cat > /opt/ytapp/requirements.txt << 'EOF'
Flask==2.3.3
yt-dlp==2023.11.16
Werkzeug==2.3.7
EOF

# Install Python dependencies
echo "Installing Python dependencies..."
pip3 install -r /opt/ytapp/requirements.txt

# Create systemd service file
echo "Creating systemd service..."
cat > /etc/systemd/system/ytapp.service << 'EOF'
[Unit]
Description=YouTube Download Flask App
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/ytapp
Environment=PATH=/usr/local/bin:/usr/bin:/bin
ExecStart=/usr/bin/python3 /opt/ytapp/app.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Set proper permissions
echo "Setting permissions..."
chmod +x /opt/ytapp/app.py
chown -R root:root /opt/ytapp

# Reload systemd and enable service
echo "Enabling and starting service..."
systemctl daemon-reload
systemctl enable ytapp
systemctl start ytapp

# Wait a moment for service to start
sleep 5

# Check if service is running
if systemctl is-active --quiet ytapp; then
    echo "✅ YouTube Download service is running successfully!"
    echo "Service status:"
    systemctl status ytapp --no-pager -l
else
    echo "❌ Service failed to start. Checking logs:"
    journalctl -u ytapp --no-pager -l
    exit 1
fi

echo "🎉 YouTube Download VM setup completed!"
echo "Your app is now running on port 8000"
echo "Test with: curl http://$(curl -s ifconfig.me):8000/health" 