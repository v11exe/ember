param(
  [string]$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$squareSource = Join-Path $RepositoryRoot 'src\renderer\assets\ember-app-icon.png'
$horizontalSource = Join-Path $RepositoryRoot 'src\renderer\assets\ember-icon.png'
$outputRoot = Join-Path $RepositoryRoot 'chromium\resources\branding'
New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null

function Write-ScaledPng {
  param(
    [string]$Source,
    [int]$CanvasWidth,
    [int]$CanvasHeight,
    [string]$Destination
  )

  $image = [System.Drawing.Image]::FromFile($Source)
  try {
    $scale = [Math]::Min($CanvasWidth / $image.Width, $CanvasHeight / $image.Height)
    $width = [Math]::Max(1, [int][Math]::Round($image.Width * $scale))
    $height = [Math]::Max(1, [int][Math]::Round($image.Height * $scale))
    $x = [int][Math]::Floor(($CanvasWidth - $width) / 2)
    $y = [int][Math]::Floor(($CanvasHeight - $height) / 2)
    $bitmap = New-Object System.Drawing.Bitmap(
      $CanvasWidth,
      $CanvasHeight,
      [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    )
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.DrawImage($image, $x, $y, $width, $height)
      } finally {
        $graphics.Dispose()
      }
      $bitmap.Save($Destination, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $bitmap.Dispose()
    }
  } finally {
    $image.Dispose()
  }
}

function Write-EmbeddedSvg {
  param(
    [string]$PngSource,
    [int]$Width,
    [int]$Height,
    [string]$Destination
  )

  $base64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($PngSource))
  $svg = '<svg xmlns="http://www.w3.org/2000/svg" width="{0}" height="{1}" viewBox="0 0 {0} {1}"><image width="{0}" height="{1}" href="data:image/png;base64,{2}"/></svg>' -f $Width, $Height, $base64
  [IO.File]::WriteAllText($Destination, "$svg`n", [Text.UTF8Encoding]::new($false))
}

$iconSizes = @(16, 24, 32, 48, 64, 128, 256)
foreach ($size in $iconSizes) {
  Write-ScaledPng `
    -Source $squareSource `
    -CanvasWidth $size `
    -CanvasHeight $size `
    -Destination (Join-Path $outputRoot "app-$size.png")
}

Write-ScaledPng `
  -Source $horizontalSource `
  -CanvasWidth 171 `
  -CanvasHeight 32 `
  -Destination (Join-Path $outputRoot 'about-logo.png')
Write-ScaledPng `
  -Source $horizontalSource `
  -CanvasWidth 342 `
  -CanvasHeight 64 `
  -Destination (Join-Path $outputRoot 'about-logo-200.png')

Write-EmbeddedSvg `
  -PngSource (Join-Path $outputRoot 'app-256.png') `
  -Width 256 `
  -Height 256 `
  -Destination (Join-Path $outputRoot 'product-logo.svg')
Write-EmbeddedSvg `
  -PngSource (Join-Path $outputRoot 'app-256.png') `
  -Width 160 `
  -Height 160 `
  -Destination (Join-Path $outputRoot 'product-logo-animation.svg')
Write-EmbeddedSvg `
  -PngSource (Join-Path $outputRoot 'app-24.png') `
  -Width 24 `
  -Height 24 `
  -Destination (Join-Path $outputRoot 'webui-logo-dark.svg')

$icoSizes = @(16, 32, 48, 256)
$icoImages = [Collections.Generic.List[byte[]]]::new()
foreach ($size in $icoSizes) {
  $icoImages.Add([IO.File]::ReadAllBytes((Join-Path $outputRoot "app-$size.png")))
}
$icoPath = Join-Path $outputRoot 'ember.ico'
$stream = [IO.File]::Open($icoPath, [IO.FileMode]::Create, [IO.FileAccess]::Write)
try {
  $writer = New-Object IO.BinaryWriter($stream)
  try {
    $writer.Write([UInt16]0)
    $writer.Write([UInt16]1)
    $writer.Write([UInt16]$icoImages.Count)
    $offset = 6 + (16 * $icoImages.Count)
    for ($index = 0; $index -lt $icoImages.Count; $index++) {
      $size = $icoSizes[$index]
      $writer.Write([Byte]$(if ($size -eq 256) { 0 } else { $size }))
      $writer.Write([Byte]$(if ($size -eq 256) { 0 } else { $size }))
      $writer.Write([Byte]0)
      $writer.Write([Byte]0)
      $writer.Write([UInt16]1)
      $writer.Write([UInt16]32)
      $writer.Write([UInt32]$icoImages[$index].Length)
      $writer.Write([UInt32]$offset)
      $offset += $icoImages[$index].Length
    }
    foreach ($bytes in $icoImages) {
      $writer.Write($bytes)
    }
  } finally {
    $writer.Dispose()
  }
} finally {
  $stream.Dispose()
}

Get-ChildItem -LiteralPath $outputRoot -File |
  Sort-Object Name |
  Select-Object Name, Length
