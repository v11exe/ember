param(
  [Parameter(Mandatory = $true)]
  [string]$Output,
  [Parameter(Mandatory = $true)]
  [int]$Left,
  [Parameter(Mandatory = $true)]
  [int]$Top,
  [Parameter(Mandatory = $true)]
  [int]$Width,
  [Parameter(Mandatory = $true)]
  [int]$Height
)

Add-Type -AssemblyName System.Drawing

$bitmap = [System.Drawing.Bitmap]::new(
  $Width,
  $Height,
  [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)

try {
  $graphics.CopyFromScreen(
    [System.Drawing.Point]::new($Left, $Top),
    [System.Drawing.Point]::Empty,
    [System.Drawing.Size]::new($Width, $Height),
    [System.Drawing.CopyPixelOperation]::SourceCopy
  )
  $directory = Split-Path -Parent $Output
  if ($directory) {
    [System.IO.Directory]::CreateDirectory($directory) | Out-Null
  }
  $bitmap.Save($Output, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $graphics.Dispose()
  $bitmap.Dispose()
}
