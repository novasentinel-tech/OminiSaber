Add-Type -AssemblyName System.Drawing

$assets = @(
  @{ Source = "frontend/login/assets/jornada-ominisaber-3d.png"; Target = "frontend/login/assets/jornada-ominisaber-3d.jpg"; MaxWidth = 1100 },
  @{ Source = "frontend/aluno/modulo_de_trilhas/matematica/assets/01-1o-ano-maquina-de-padroes.png"; Target = "frontend/aluno/modulo_de_trilhas/matematica/assets/01-1o-ano-maquina-de-padroes.jpg"; MaxWidth = 1000 },
  @{ Source = "frontend/aluno/modulo_de_trilhas/matematica/assets/02-2o-ano-estudio-de-areas.png"; Target = "frontend/aluno/modulo_de_trilhas/matematica/assets/02-2o-ano-estudio-de-areas.jpg"; MaxWidth = 1000 },
  @{ Source = "frontend/aluno/modulo_de_trilhas/matematica/assets/03-3o-ano-reta-em-movimento.png"; Target = "frontend/aluno/modulo_de_trilhas/matematica/assets/03-3o-ano-reta-em-movimento.jpg"; MaxWidth = 1000 },
  @{ Source = "frontend/aluno/modulo_de_trilhas/portugues/assets/mapa-linguistico-brasil.png"; Target = "frontend/aluno/modulo_de_trilhas/portugues/assets/mapa-linguistico-brasil.jpg"; MaxWidth = 1000 },
  @{ Source = "frontend/aluno/modulo_de_trilhas/portugues/assets/brasil-em-contraste.png"; Target = "frontend/aluno/modulo_de_trilhas/portugues/assets/brasil-em-contraste.jpg"; MaxWidth = 900 }
)

$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
  Where-Object { $_.MimeType -eq "image/jpeg" }
$qualityEncoder = [System.Drawing.Imaging.Encoder]::Quality

foreach ($asset in $assets) {
  $sourcePath = Join-Path $PSScriptRoot "..\$($asset.Source)"
  $targetPath = Join-Path $PSScriptRoot "..\$($asset.Target)"
  $source = [System.Drawing.Image]::FromFile($sourcePath)
  try {
    $width = [Math]::Min($asset.MaxWidth, $source.Width)
    $height = [Math]::Round($source.Height * ($width / $source.Width))
    $bitmap = New-Object System.Drawing.Bitmap($width, $height)
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.Clear([System.Drawing.Color]::White)
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.DrawImage($source, 0, 0, $width, $height)
      } finally {
        $graphics.Dispose()
      }
      $parameters = New-Object System.Drawing.Imaging.EncoderParameters(1)
      $parameters.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter($qualityEncoder, [long]84)
      $bitmap.Save($targetPath, $jpegCodec, $parameters)
      $parameters.Dispose()
    } finally {
      $bitmap.Dispose()
    }
  } finally {
    $source.Dispose()
  }
}

$assets | ForEach-Object {
  $source = Get-Item (Join-Path $PSScriptRoot "..\$($_.Source)")
  $target = Get-Item (Join-Path $PSScriptRoot "..\$($_.Target)")
  [pscustomobject]@{
    Asset = $target.Name
    BeforeKiB = [Math]::Round($source.Length / 1KB)
    AfterKiB = [Math]::Round($target.Length / 1KB)
  }
}
