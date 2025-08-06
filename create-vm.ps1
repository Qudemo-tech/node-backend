# YouTube Download VM Setup Script (PowerShell)
Write-Host "Starting YouTube Download VM Setup..." -ForegroundColor Green

# Set variables
$VM_NAME = "yt-download-vm"
$ZONE = "us-central1-a"
$STATIC_IP_NAME = "yt-download-ip"
$REGION = "us-central1"

Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "  VM Name: $VM_NAME" -ForegroundColor White
Write-Host "  Zone: $ZONE" -ForegroundColor White
Write-Host "  Region: $REGION" -ForegroundColor White
Write-Host "  Static IP: $STATIC_IP_NAME" -ForegroundColor White
Write-Host ""

# Confirm before proceeding
$confirmation = Read-Host "Continue with this configuration? (y/N)"
if ($confirmation -ne "y" -and $confirmation -ne "Y") {
    Write-Host "Setup cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host "Starting VM setup..." -ForegroundColor Green

# Step 1: Reserve Static IP
Write-Host "1. Reserving static IP..." -ForegroundColor Cyan
try {
    gcloud compute addresses create $STATIC_IP_NAME --region=$REGION --quiet
    $STATIC_IP = gcloud compute addresses describe $STATIC_IP_NAME --region=$REGION --format="value(address)"
    Write-Host "  Static IP reserved: $STATIC_IP" -ForegroundColor Green
} catch {
    Write-Host "  Failed to reserve static IP" -ForegroundColor Red
    exit 1
}

# Step 2: Create Firewall Rule
Write-Host "2. Creating firewall rule..." -ForegroundColor Cyan
try {
    gcloud compute firewall-rules create yt-download-allow-8000 --direction=INGRESS --priority=1000 --network=default --action=ALLOW --rules=tcp:8000 --source-ranges=0.0.0.0/0 --target-tags=yt-download --quiet
    Write-Host "  Firewall rule created" -ForegroundColor Green
} catch {
    Write-Host "  Failed to create firewall rule" -ForegroundColor Red
    exit 1
}

# Step 3: Create VM with Startup Script
Write-Host "3. Creating VM with startup script..." -ForegroundColor Cyan
try {
    gcloud compute instances create $VM_NAME --zone=$ZONE --machine-type=e2-small --image-family=ubuntu-2204-lts --image-project=ubuntu-os-cloud --tags=yt-download --address=$STATIC_IP --metadata-from-file=startup-script=startup-script.sh --metadata=shutdown-script=shutdown-script.sh --quiet
    Write-Host "  VM created successfully" -ForegroundColor Green
} catch {
    Write-Host "  Failed to create VM" -ForegroundColor Red
    exit 1
}

# Step 4: Wait for VM to be ready
Write-Host "4. Waiting for VM to be ready..." -ForegroundColor Cyan
Write-Host "  This may take a few minutes while the startup script runs..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

Write-Host ""
Write-Host "Setup completed!" -ForegroundColor Green
Write-Host ""
Write-Host "VM Information:" -ForegroundColor Cyan
Write-Host "  Name: $VM_NAME" -ForegroundColor White
Write-Host "  Zone: $ZONE" -ForegroundColor White
Write-Host "  Static IP: $STATIC_IP" -ForegroundColor White
Write-Host "  External URL: http://$STATIC_IP:8000" -ForegroundColor White
Write-Host ""
Write-Host "Testing the service..." -ForegroundColor Cyan
Write-Host "  Health check: curl http://$STATIC_IP:8000/health" -ForegroundColor White
Write-Host "  Download test: curl http://$STATIC_IP:8000/download?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ" -ForegroundColor White
Write-Host ""
Write-Host "Useful commands:" -ForegroundColor Cyan
Write-Host "  SSH into VM: gcloud compute ssh $VM_NAME --zone=$ZONE" -ForegroundColor White
Write-Host "  Check service status: gcloud compute ssh $VM_NAME --zone=$ZONE --command='sudo systemctl status ytapp'" -ForegroundColor White
Write-Host "  View logs: gcloud compute ssh $VM_NAME --zone=$ZONE --command='sudo journalctl -u ytapp -f'" -ForegroundColor White
Write-Host ""
Write-Host "To upload YouTube cookies (optional):" -ForegroundColor Cyan
Write-Host "  gcloud compute scp youtube_cookies.txt ${VM_NAME}:/opt/ytapp/ --zone=${ZONE}" -ForegroundColor White
Write-Host ""
Write-Host "To clean up resources:" -ForegroundColor Cyan
Write-Host "  gcloud compute instances delete $VM_NAME --zone=$ZONE" -ForegroundColor White
Write-Host "  gcloud compute addresses delete $STATIC_IP_NAME --region=$REGION" -ForegroundColor White
Write-Host "  gcloud compute firewall-rules delete yt-download-allow-8000" -ForegroundColor White
Write-Host ""

# Test health endpoint
Write-Host "Testing health endpoint..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://$STATIC_IP:8000/health" -TimeoutSec 10 -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) {
        Write-Host "  Service is responding!" -ForegroundColor Green
        Write-Host "  Health check response:" -ForegroundColor White
        Write-Host $response.Content -ForegroundColor Gray
    } else {
        Write-Host "  Service responded with status: $($response.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  Service not responding yet. The startup script may still be running." -ForegroundColor Yellow
    Write-Host "  Please wait a few more minutes and try again." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Your YouTube Download VM is ready!" -ForegroundColor Green 