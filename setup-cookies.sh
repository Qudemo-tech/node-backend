#!/bin/bash

# YouTube Cookies Setup Helper
# This script helps you set up cookies for authenticated YouTube downloads

echo "🍪 YouTube Cookies Setup Helper"
echo "================================"

# Check if VM exists
VM_NAME="yt-download-vm"
ZONE="us-central1-a"

if ! gcloud compute instances describe $VM_NAME --zone=$ZONE >/dev/null 2>&1; then
    echo "❌ VM '$VM_NAME' not found. Please run setup-vm.sh first."
    exit 1
fi

echo "✅ Found VM: $VM_NAME"

# Check if cookies file exists
if [ -f "youtube_cookies.txt" ]; then
    echo "✅ Found existing cookies file: youtube_cookies.txt"
    echo ""
    echo "📋 File contents preview:"
    head -5 youtube_cookies.txt
    echo "..."
    echo ""
    
    read -p "Use existing cookies file? (Y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Nn]$ ]]; then
        echo "Please delete youtube_cookies.txt and run this script again."
        exit 0
    fi
else
    echo "❌ No cookies file found. Let's create one!"
    echo ""
    echo "📝 How to get YouTube cookies:"
    echo ""
    echo "1️⃣  EASIEST METHOD - Browser Extension:"
    echo "   • Install 'Get cookies.txt' extension for Chrome/Firefox"
    echo "   • Go to YouTube and log in"
    echo "   • Click extension icon → Export cookies"
    echo "   • Save as 'youtube_cookies.txt'"
    echo ""
    echo "2️⃣  MANUAL METHOD - Browser Developer Tools:"
    echo "   • Open YouTube in browser (logged in)"
    echo "   • Press F12 → Application → Cookies → youtube.com"
    echo "   • Copy all cookies to 'youtube_cookies.txt'"
    echo ""
    echo "3️⃣  COMMAND LINE METHOD:"
    echo "   • curl -c youtube_cookies.txt -b youtube_cookies.txt 'https://www.youtube.com'"
    echo ""
    
    read -p "Have you created youtube_cookies.txt? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Please create youtube_cookies.txt first, then run this script again."
        exit 0
    fi
    
    if [ ! -f "youtube_cookies.txt" ]; then
        echo "❌ youtube_cookies.txt still not found. Please create it first."
        exit 1
    fi
fi

# Validate cookies file format
echo "🔍 Validating cookies file..."
if ! head -1 youtube_cookies.txt | grep -q "Netscape\|# HTTP Cookie File"; then
    echo "⚠️  Warning: Cookies file doesn't look like standard Netscape format"
    echo "   This might still work, but could cause issues."
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 0
    fi
fi

# Upload cookies to VM
echo "📤 Uploading cookies to VM..."
gcloud compute scp youtube_cookies.txt $VM_NAME:/opt/ytapp/ \
    --zone=$ZONE \
    --quiet

if [ $? -eq 0 ]; then
    echo "✅ Cookies uploaded successfully!"
else
    echo "❌ Failed to upload cookies. Please check your connection."
    exit 1
fi

# Test cookies functionality
echo ""
echo "🧪 Testing cookies functionality..."
STATIC_IP=$(gcloud compute addresses describe yt-download-ip --region=us-central1 --format="value(address)" 2>/dev/null)

if [ -n "$STATIC_IP" ]; then
    echo "   Testing health endpoint..."
    if curl -s "http://$STATIC_IP:8000/health" > /dev/null; then
        echo "   ✅ Service is running"
        echo ""
        echo "🎉 Cookies setup completed!"
        echo ""
        echo "📝 Usage examples:"
        echo "   # Public video (no cookies needed):"
        echo "   curl \"http://$STATIC_IP:8000/download?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ\""
        echo ""
        echo "   # Age-restricted/private video (with cookies):"
        echo "   curl \"http://$STATIC_IP:8000/download?url=https://www.youtube.com/watch?v=VIDEO_ID&use_cookies=true\""
        echo ""
        echo "🔍 To check if cookies are working:"
        echo "   gcloud compute ssh $VM_NAME --zone=$ZONE --command=\"ls -la /opt/ytapp/youtube_cookies.txt\""
    else
        echo "   ⚠️  Service not responding. VM might still be starting up."
    fi
else
    echo "   ⚠️  Could not get static IP. Please check your VM setup."
fi

echo ""
echo "✨ Cookies setup process completed!" 