$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Push-Location $projectRoot
try {
    New-Item -ItemType Directory -Force -Path "build", "dist" | Out-Null
    & node "scripts/fetch-node-license.cjs"
    if ($LASTEXITCODE -ne 0) { throw "Node.js 라이선스 준비에 실패했습니다." }

    & npm exec -- esbuild "src/server.cjs" --bundle --platform=node --format=cjs --target=node24 --outfile="build/app.cjs"
    if ($LASTEXITCODE -ne 0) { throw "JavaScript 번들 생성에 실패했습니다." }

    & node --experimental-sea-config "sea-config.json"
    if ($LASTEXITCODE -ne 0) { throw "SEA blob 생성에 실패했습니다." }

    $executable = "dist/kr-rnd-preflight-windows-x64.exe"
    Copy-Item -LiteralPath (Get-Command node).Source -Destination $executable -Force
    & node "scripts/strip-pe-signature.cjs" $executable
    if ($LASTEXITCODE -ne 0) { throw "기존 Node.js 실행 파일 서명 제거에 실패했습니다." }
    & npm exec -- postject $executable NODE_SEA_BLOB "dist/sea-prep.blob" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
    if ($LASTEXITCODE -ne 0) { throw "실행 파일에 애플리케이션 삽입을 실패했습니다." }

    $hash = (Get-FileHash -LiteralPath $executable -Algorithm SHA256).Hash.ToLowerInvariant()
    "$hash  kr-rnd-preflight-windows-x64.exe" | Set-Content -LiteralPath "dist/SHA256SUMS.txt" -Encoding ascii
    Copy-Item -LiteralPath "build/THIRD_PARTY_LICENSES.txt" -Destination "dist/THIRD_PARTY_LICENSES.txt" -Force
    $archive = "dist/kr-rnd-preflight-windows-x64.zip"
    Compress-Archive -LiteralPath $executable, "dist/SHA256SUMS.txt", "dist/THIRD_PARTY_LICENSES.txt", "LICENSE", "README.md" -DestinationPath $archive -CompressionLevel Optimal -Force
    $archiveHash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
    @(
        "$hash  kr-rnd-preflight-windows-x64.exe"
        "$archiveHash  kr-rnd-preflight-windows-x64.zip"
    ) | Set-Content -LiteralPath "dist/SHA256SUMS.txt" -Encoding ascii
    Write-Output "Built: $executable"
    Write-Output "SHA256: $hash"
    Write-Output "Built: $archive"
    Write-Output "SHA256: $archiveHash"
} finally {
    Pop-Location
}
