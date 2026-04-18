#!/usr/bin/env pwsh
# Real-time workflow monitor for publish-cli.yml

$repo = "ngandimoun/pi-api"
$workflow = "publish-cli.yml"
$apiUrl = "https://api.github.com/repos/$repo/actions/workflows/$workflow/runs?per_page=1"

Write-Host "Monitoring workflow: $workflow" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray
Write-Host ""

$lastStatus = ""
$lastConclusion = ""

while ($true) {
    try {
        $response = Invoke-RestMethod -Uri $apiUrl -Headers @{
            "Accept" = "application/vnd.github.v3+json"
            "User-Agent" = "PowerShell"
        }
        
        if ($response.workflow_runs.Count -gt 0) {
            $run = $response.workflow_runs[0]
            $status = $run.status
            $conclusion = $run.conclusion
            $runId = $run.id
            $createdAt = $run.created_at
            $url = $run.html_url
            
            if ($status -ne $lastStatus -or $conclusion -ne $lastConclusion) {
                $timestamp = Get-Date -Format "HH:mm:ss"
                Write-Host "[$timestamp] " -NoNewline -ForegroundColor Gray
                
                if ($status -eq "completed") {
                    if ($conclusion -eq "success") {
                        Write-Host "[OK] SUCCESS" -ForegroundColor Green
                        Write-Host "  Packages published to npm!" -ForegroundColor Green
                        Write-Host "  Check: npm view @pi-api/cli@0.1.1" -ForegroundColor Cyan
                        Write-Host "  Check: npm view pi-hokage@0.1.1" -ForegroundColor Cyan
                        break
                    } elseif ($conclusion -eq "failure") {
                        Write-Host "[FAIL] FAILED" -ForegroundColor Red
                        Write-Host "  URL: $url" -ForegroundColor Yellow
                        break
                    } else {
                        Write-Host "[??] $conclusion" -ForegroundColor Yellow
                    }
                } elseif ($status -eq "in_progress") {
                    Write-Host "[...] IN PROGRESS (Run #$runId)" -ForegroundColor Yellow
                } elseif ($status -eq "queued") {
                    Write-Host "[...] QUEUED" -ForegroundColor Cyan
                } else {
                    Write-Host "Status: $status" -ForegroundColor White
                }
                
                $lastStatus = $status
                $lastConclusion = $conclusion
            }
        } else {
            Write-Host "No workflow runs found yet..." -ForegroundColor Gray
        }
        
        Start-Sleep -Seconds 5
    }
    catch {
        Write-Host "Error: $_" -ForegroundColor Red
        Start-Sleep -Seconds 10
    }
}

Write-Host ""
Write-Host "Monitoring stopped." -ForegroundColor Gray
