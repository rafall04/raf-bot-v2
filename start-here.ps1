# RAF Bot V2 - Development Starter (PowerShell)

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "           RAF BOT V2 - DEVELOPMENT STARTER" -ForegroundColor Yellow
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Starting Command Center..." -ForegroundColor Green
Write-Host ""
Write-Host "This will help you:" -ForegroundColor White
Write-Host "- Check system health" -ForegroundColor Gray
Write-Host "- Generate AI prompts" -ForegroundColor Gray
Write-Host "- Manage WiFi system" -ForegroundColor Gray
Write-Host "- Run tests" -ForegroundColor Gray
Write-Host "- Fix common issues" -ForegroundColor Gray
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

node tools/command-center.js

Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
