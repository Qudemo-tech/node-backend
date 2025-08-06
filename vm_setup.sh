#!/bin/bash
# Setup script for Google Cloud VM YouTube Downloader

echo "🚀 Setting up YouTube Downloader VM..."

# Update system
echo "📦 Updating system packages..."
sudo apt-get update
sudo apt-get install -y python3 python3-pip python3-venv curl wget git unzip

# Install Chrome
echo "🌐 Installing Google Chrome..."
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
sudo apt-get update
sudo apt-get install -y google-chrome-stable

# Install Python packages
echo "🐍 Installing Python packages..."
pip3 install yt-dlp requests selenium webdriver-manager

# Create working directory
echo "📁 Creating working directory..."
mkdir -p ~/youtube-downloader
cd ~/youtube-downloader

# Test installations
echo "🧪 Testing installations..."
echo "yt-dlp version:"
yt-dlp --version

echo "Chrome version:"
google-chrome --version

echo "Python packages:"
pip3 list | grep -E "(yt-dlp|requests|selenium|webdriver-manager)"

echo "✅ VM setup complete!"
echo "📂 Working directory: ~/youtube-downloader"
echo "🎯 Ready to download YouTube videos!" 