#!/bin/bash

# YouTube Download VM Setup Script
# This script creates a Google Cloud VM with a YouTube download service

set -e  # Exit on any error

echo "🎬 YouTube Download VM Setup"
echo "=============================="

# Check if gcloud is configured
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "❌ gcloud CLI is not configured. Please run 'gcloud auth login' first."
    exit 1
fi

# Get project ID
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
    echo "❌ No project ID configured. Please set your project:"
    echo "   gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

echo "✅ Using project: $PROJECT_ID"

# Set variables
VM_NAME="yt-download-vm"
ZONE="us-central1-a"
STATIC_IP_NAME="yt-download-ip"
REGION=$(echo $ZONE | cut -d'-' -f1,2)

echo "📋 Configuration:"
echo "   VM Name: $VM_NAME"
echo "   Zone: $ZONE"
echo "   Region: $REGION"
echo "   Static IP: $STATIC_IP_NAME"
echo ""

# Confirm before proceeding
read -p "Continue with this configuration? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Setup cancelled."
    exit 0
fi

echo ""
echo "🚀 Starting VM setup..."

# Step 1: Reserve Static IP
echo "1️⃣  Reserving static IP..."
gcloud compute addresses create $STATIC_IP_NAME \
    --project=$PROJECT_ID \
    --region=$REGION \
    --quiet

STATIC_IP=$(gcloud compute addresses describe $STATIC_IP_NAME --region=$REGION --format="value(address)")
echo "   ✅ Static IP reserved: $STATIC_IP"

# Step 2: Create Firewall Rule
echo "2️⃣  Creating firewall rule..."
gcloud compute firewall-rules create yt-download-allow-8000 \
    --project=$PROJECT_ID \
    --direction=INGRESS \
    --priority=1000 \
    --network=default \
    --action=ALLOW \
    --rules=tcp:8000 \
    --source-ranges=0.0.0.0/0 \
    --target-tags=yt-download \
    --quiet

echo "   ✅ Firewall rule created"

# Step 3: Create VM with Startup Script
echo "3️⃣  Creating VM with startup script..."
gcloud compute instances create $VM_NAME \
    --project=$PROJECT_ID \
    --zone=$ZONE \
    --machine-type=e2-small \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --tags=yt-download \
    --address=$STATIC_IP \
    --metadata-from-file=startup-script=startup-script.sh \
    --metadata=shutdown-script=shutdown-script.sh \
    --quiet

echo "   ✅ VM created successfully"

# Step 4: Wait for VM to be ready
echo "4️⃣  Waiting for VM to be ready..."
echo "   This may take a few minutes while the startup script runs..."
sleep 30

# Check if VM is running
VM_STATUS=$(gcloud compute instances describe $VM_NAME --zone=$ZONE --format="value(status)")
if [ "$VM_STATUS" != "RUNNING" ]; then
    echo "   ⚠️  VM is not running yet. Status: $VM_STATUS"
    echo "   Please wait a bit longer and check manually:"
    echo "   gcloud compute instances describe $VM_NAME --zone=$ZONE"
fi

echo ""
echo "🎉 Setup completed!"
echo ""
echo "📊 VM Information:"
echo "   Name: $VM_NAME"
echo "   Zone: $ZONE"
echo "   Static IP: $STATIC_IP"
echo "   External URL: http://$STATIC_IP:8000"
echo ""
echo "🧪 Testing the service..."
echo "   Health check: curl http://$STATIC_IP:8000/health"
echo "   Download test: curl \"http://$STATIC_IP:8000/download?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ\""
echo ""
echo "📝 Useful commands:"
echo "   SSH into VM: gcloud compute ssh $VM_NAME --zone=$ZONE"
echo "   Check service status: gcloud compute ssh $VM_NAME --zone=$ZONE --command=\"sudo systemctl status ytapp\""
echo "   View logs: gcloud compute ssh $VM_NAME --zone=$ZONE --command=\"sudo journalctl -u ytapp -f\""
echo ""
echo "🍪 To upload YouTube cookies (optional):"
echo "   gcloud compute scp youtube_cookies.txt $VM_NAME:/opt/ytapp/ --zone=$ZONE"
echo ""
echo "🗑️  To clean up resources:"
echo "   gcloud compute instances delete $VM_NAME --zone=$ZONE"
echo "   gcloud compute addresses delete $STATIC_IP_NAME --region=$REGION"
echo "   gcloud compute firewall-rules delete yt-download-allow-8000"
echo ""

# Test health endpoint
echo "🔍 Testing health endpoint..."
if curl -s "http://$STATIC_IP:8000/health" > /dev/null 2>&1; then
    echo "   ✅ Service is responding!"
    echo "   Health check response:"
    curl -s "http://$STATIC_IP:8000/health" | python3 -m json.tool 2>/dev/null || curl -s "http://$STATIC_IP:8000/health"
else
    echo "   ⚠️  Service not responding yet. The startup script may still be running."
    echo "   Please wait a few more minutes and try again."
fi

echo ""
echo "✨ Your YouTube Download VM is ready!" 