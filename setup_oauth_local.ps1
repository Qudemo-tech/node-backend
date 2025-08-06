# OAuth Local Setup Script for Windows PowerShell

Write-Host "🔐 YouTube OAuth 2.0 Local Setup" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green

# Check if OAuth token is already set
$currentToken = $env:YOUTUBE_OAUTH_TOKEN

if ($currentToken) {
    Write-Host "✅ OAuth token already set: $($currentToken.Substring(0, 20))..." -ForegroundColor Green
    Write-Host "Ready to test!" -ForegroundColor Green
} else {
    Write-Host "❌ No OAuth token found." -ForegroundColor Red
    Write-Host ""
    Write-Host "📋 To get your OAuth token:" -ForegroundColor Yellow
    Write-Host "1. Go to: https://developers.google.com/oauthplayground/" -ForegroundColor White
    Write-Host "2. Click settings (⚙️) → 'Use your own OAuth credentials'" -ForegroundColor White
    Write-Host "3. Enter your Client ID: 930221984182-40aj9dtn15flv0g0kv0h72kupt01kpno.apps.googleusercontent.com" -ForegroundColor White
    Write-Host "4. Enter your Client Secret" -ForegroundColor White
    Write-Host "5. Select scope: YouTube Data v3 → https://www.googleapis.com/auth/youtube.readonly" -ForegroundColor White
    Write-Host "6. Click 'Authorize APIs' → 'Exchange authorization code for tokens'" -ForegroundColor White
    Write-Host "7. Copy the Access Token" -ForegroundColor White
    Write-Host ""
    
    $token = Read-Host "🔑 Enter your OAuth token (or press Enter to skip)"
    
    if ($token) {
        $env:YOUTUBE_OAUTH_TOKEN = $token
        Write-Host "✅ OAuth token set successfully!" -ForegroundColor Green
        Write-Host "Token preview: $($token.Substring(0, 20))..." -ForegroundColor Green
    } else {
        Write-Host "⚠️  No token entered. You can set it manually with:" -ForegroundColor Yellow
        Write-Host '$env:YOUTUBE_OAUTH_TOKEN="your_token_here"' -ForegroundColor Cyan
    }
}

Write-Host ""
Write-Host "🧪 To test the OAuth implementation, run:" -ForegroundColor Yellow
Write-Host "node test_oauth_local.js" -ForegroundColor Cyan 