#!/bin/bash
# Startup script for YouTube Downloader VM

echo "Starting YouTube Downloader VM setup..."

# Update system
apt-get update
apt-get install -y python3 python3-pip python3-venv curl wget git unzip

# Install Chrome and ChromeDriver
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list
apt-get update
apt-get install -y google-chrome-stable

# Install Python packages
pip3 install yt-dlp requests selenium webdriver-manager

# Create working directory
mkdir -p /opt/youtube-downloader
cd /opt/youtube-downloader

# Create a simple test script
cat > test_download.py << 'EOF'
#!/usr/bin/env python3
import subprocess
import sys

def test_ytdlp():
    try:
        result = subprocess.run(['yt-dlp', '--version'], capture_output=True, text=True)
        print(f"yt-dlp version: {result.stdout.strip()}")
        return True
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    test_ytdlp()
EOF

chmod +x test_download.py

echo "YouTube Downloader VM setup complete!"
echo "yt-dlp and dependencies installed successfully" 