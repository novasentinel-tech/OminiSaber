$projectRoot = Split-Path $PSScriptRoot -Parent
$source = Join-Path $projectRoot "backend/node_modules/@supabase/supabase-js/dist/umd/supabase.js"
$vendorDirectory = Join-Path $projectRoot "backend/vendor"
$target = Join-Path $vendorDirectory "supabase-2.112.3.js"

if (-not (Test-Path -LiteralPath $source)) {
  throw "Supabase UMD bundle not found at $source"
}

New-Item -ItemType Directory -Path $vendorDirectory -Force | Out-Null
Copy-Item -LiteralPath $source -Destination $target -Force

$pattern = '<script\s+src="https://cdn\.jsdelivr\.net/npm/@supabase/supabase-js@[^\"]*"\s*></script>'
$replacement = '<script src="/backend/vendor/supabase-2.112.3.js"></script>'
$updated = 0

Get-ChildItem -LiteralPath (Join-Path $projectRoot "frontend") -Recurse -Filter "*.html" | ForEach-Object {
  $content = [System.IO.File]::ReadAllText($_.FullName)
  $next = [regex]::Replace($content, $pattern, $replacement)
  if ($next -ne $content) {
    [System.IO.File]::WriteAllText($_.FullName, $next, (New-Object System.Text.UTF8Encoding($false)))
    $updated += 1
  }
}

[pscustomobject]@{
  Bundle = $target
  Version = "2.112.3"
  PagesUpdated = $updated
  Bytes = (Get-Item -LiteralPath $target).Length
}
