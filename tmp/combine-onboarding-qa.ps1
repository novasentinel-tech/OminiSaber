Add-Type -AssemblyName System.Drawing

function New-ComparisonImage {
  param(
    [string]$SourcePath,
    [string]$ImplementationPath,
    [string]$OutputPath
  )

  $source = [System.Drawing.Image]::FromFile($SourcePath)
  $implementation = [System.Drawing.Image]::FromFile($ImplementationPath)
  try {
    $panelWidth = 1200
    $labelHeight = 56
    $sourceHeight = [Math]::Round($source.Height * ($panelWidth / $source.Width))
    $implementationHeight = [Math]::Round($implementation.Height * ($panelWidth / $implementation.Width))
    $canvasHeight = [Math]::Max($sourceHeight, $implementationHeight) + $labelHeight
    $canvas = New-Object System.Drawing.Bitmap ($panelWidth * 2), $canvasHeight
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($canvas)
      try {
        $graphics.Clear([System.Drawing.Color]::White)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.DrawImage($source, 0, $labelHeight, $panelWidth, $sourceHeight)
        $graphics.DrawImage($implementation, $panelWidth, $labelHeight, $panelWidth, $implementationHeight)
        $font = New-Object System.Drawing.Font("Segoe UI", 22, [System.Drawing.FontStyle]::Bold)
        $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(16, 34, 68))
        try {
          $graphics.DrawString("REFERENCIA", $font, $brush, 24, 12)
          $graphics.DrawString("IMPLEMENTACAO", $font, $brush, ($panelWidth + 24), 12)
        }
        finally {
          $font.Dispose()
          $brush.Dispose()
        }
      }
      finally {
        $graphics.Dispose()
      }
      $canvas.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
      $canvas.Dispose()
    }
  }
  finally {
    $source.Dispose()
    $implementation.Dispose()
  }
}

$generatedRoot = "C:\Users\CLEVERSON\.codex\generated_images\01a0bd78-5646-7ba0-87a4-e03c33a505a7"
New-ComparisonImage `
  -SourcePath "$generatedRoot\exec-17bef023-fe6b-49d7-8122-dde70954da3e.png" `
  -ImplementationPath "tmp\onboarding-qa\welcome-desktop.png" `
  -OutputPath "tmp\onboarding-qa\comparison-welcome.png"
New-ComparisonImage `
  -SourcePath "$generatedRoot\exec-02f431dc-e256-4962-a184-66974807b1b2.png" `
  -ImplementationPath "tmp\onboarding-qa\tour-desktop.png" `
  -OutputPath "tmp\onboarding-qa\comparison-tour.png"
