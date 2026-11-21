$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$site = 'http://127.0.0.1:5483/'

function Test-Game {
    try {
        $page = Invoke-WebRequest -Uri $site -UseBasicParsing -TimeoutSec 2
        return $page.Content.Contains('<title>Palm Coast')
    } catch { return $false }
}

if (-not (Test-Game)) {
    if (-not (Test-Path -LiteralPath 'dist/index.html')) {
        if (-not (Test-Path -LiteralPath 'node_modules/vite/package.json')) {
            npm.cmd ci --no-audit --no-fund
            if ($LASTEXITCODE) { throw 'npm ci failed' }
        }
        npm.cmd run build
        if ($LASTEXITCODE) { throw 'Build failed' }
    }
    $python = (Get-Command python.exe -ErrorAction Stop).Source
    Start-Process -FilePath $python -ArgumentList @('-m','http.server','5483','--bind','127.0.0.1','--directory','dist') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden
    for ($tryNumber=0; $tryNumber -lt 15; $tryNumber++) {
        if (Test-Game) { break }
        Start-Sleep -Milliseconds 250
    }
    if (-not (Test-Game)) { throw "Cannot serve Palm Coast at $site" }
}
Start-Process $site
