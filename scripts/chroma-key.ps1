param(
  [string]$InputDir = "$PSScriptRoot\..\assets\raw",
  [string]$OutputDir = "$PSScriptRoot\..\assets\sprites",
  [int]$TargetSize = 320,
  [switch]$PixelArt
)

Add-Type -AssemblyName System.Drawing

if (-not (Test-Path $OutputDir)) {
  New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
}

$code = @"
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class ChromaKeyProcessor
{
    public static void ProcessImage(string inputPath, string outputPath, int targetSize, bool pixelArt)
    {
        using (var srcOrig = new Bitmap(inputPath))
        using (var bmp = new Bitmap(srcOrig.Width, srcOrig.Height, PixelFormat.Format32bppArgb))
        {
            using (var g = Graphics.FromImage(bmp))
            {
                g.DrawImage(srcOrig, 0, 0, srcOrig.Width, srcOrig.Height);
            }

            int w = bmp.Width;
            int h = bmp.Height;
            var rect = new Rectangle(0, 0, w, h);
            var data = bmp.LockBits(rect, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
            int bytes = Math.Abs(data.Stride) * h;
            byte[] buf = new byte[bytes];
            Marshal.Copy(data.Scan0, buf, 0, bytes);
            int stride = data.Stride;

            // Sample corner median green key color
            double keyR = 0, keyG = 0, keyB = 0;
            int sampleCount = 0;
            int[,] corners = new int[,] { {4,4}, {w-5,4}, {4,h-5}, {w-5,h-5}, {w/2,4}, {4,h/2}, {w-5,h/2} };
            for (int c = 0; c < corners.GetLength(0); c++)
            {
                int cx = Math.Max(0, Math.Min(w - 1, corners[c, 0]));
                int cy = Math.Max(0, Math.Min(h - 1, corners[c, 1]));
                int idx = cy * stride + cx * 4;
                keyB += buf[idx];
                keyG += buf[idx + 1];
                keyR += buf[idx + 2];
                sampleCount++;
            }
            keyR /= sampleCount;
            keyG /= sampleCount;
            keyB /= sampleCount;

            // Step 1: Flood-fill from image borders to identify exterior background pixels safely
            bool[] isBg = new bool[w * h];
            bool[] visited = new bool[w * h];
            var queue = new Queue<int>();

            Func<int, int, double> greenScore = (int x, int y) =>
            {
                int idx = y * stride + x * 4;
                double b = buf[idx];
                double g = buf[idx + 1];
                double r = buf[idx + 2];
                double maxRB = Math.Max(r, b);
                double gExcess = g - maxRB;
                double dr = r - keyR, dg = g - keyG, db = b - keyB;
                double dist = Math.Sqrt(dr * dr + dg * dg + db * db);
                // Strong green dominance OR very close to sampled key
                if (gExcess > 28 && g > 85) return 1.0;
                if (dist < 68 && gExcess > 15) return 1.0;
                return 0.0;
            };

            for (int x = 0; x < w; x++)
            {
                int top = x;
                int bot = (h - 1) * w + x;
                if (!visited[top] && greenScore(x, 0) > 0.5) { visited[top] = true; queue.Enqueue(top); }
                if (!visited[bot] && greenScore(x, h - 1) > 0.5) { visited[bot] = true; queue.Enqueue(bot); }
            }
            for (int y = 0; y < h; y++)
            {
                int left = y * w;
                int right = y * w + (w - 1);
                if (!visited[left] && greenScore(0, y) > 0.5) { visited[left] = true; queue.Enqueue(left); }
                if (!visited[right] && greenScore(w - 1, y) > 0.5) { visited[right] = true; queue.Enqueue(right); }
            }

            int[] dx = { 1, -1, 0, 0 };
            int[] dy = { 0, 0, 1, -1 };
            while (queue.Count > 0)
            {
                int cur = queue.Dequeue();
                isBg[cur] = true;
                int cx = cur % w;
                int cy = cur / w;
                for (int d = 0; d < 4; d++)
                {
                    int nx = cx + dx[d];
                    int ny = cy + dy[d];
                    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                    int ni = ny * w + nx;
                    if (visited[ni]) continue;
                    visited[ni] = true;
                    if (greenScore(nx, ny) > 0.5)
                    {
                        queue.Enqueue(ni);
                    }
                }
            }

            // Also remove enclosed pure-green pockets (e.g. gaps between twin-tails, arms, and tail)
            for (int y = 0; y < h; y++)
            {
                for (int x = 0; x < w; x++)
                {
                    int p = y * w + x;
                    if (isBg[p]) continue;
                    int idx = y * stride + x * 4;
                    double b = buf[idx], g = buf[idx + 1], r = buf[idx + 2];
                    double gExcess = g - Math.Max(r, b);
                    if (gExcess > 52 && g > 130)
                    {
                        isBg[p] = true;
                    }
                }
            }

            // Step 2: Apply alpha + soft edge feathering + green spill suppression near edges
            int minX = w, minY = h, maxX = 0, maxY = 0;
            for (int y = 0; y < h; y++)
            {
                for (int x = 0; x < w; x++)
                {
                    int p = y * w + x;
                    int idx = y * stride + x * 4;
                    if (isBg[p])
                    {
                        buf[idx + 3] = 0;
                        continue;
                    }

                    // Check if within 2px of background for edge anti-aliasing & despill
                    bool nearBg = false;
                    int bgNeighbors = 0;
                    for (int oy = -2; oy <= 2; oy++)
                    {
                        int ny = y + oy;
                        if (ny < 0 || ny >= h) continue;
                        for (int ox = -2; ox <= 2; ox++)
                        {
                            int nx = x + ox;
                            if (nx < 0 || nx >= w) continue;
                            if (isBg[ny * w + nx])
                            {
                                nearBg = true;
                                if (Math.Abs(ox) <= 1 && Math.Abs(oy) <= 1) bgNeighbors++;
                            }
                        }
                    }

                    double b = buf[idx], g = buf[idx + 1], r = buf[idx + 2];
                    double maxRB = Math.Max(r, b);
                    double gExcess = g - maxRB;

                    if (nearBg)
                    {
                        // Soft alpha on semi-green fringe pixels
                        if (gExcess > 12)
                        {
                            double t = Math.Min(1.0, (gExcess - 12.0) / 36.0);
                            int newAlpha = (int)Math.Round(255.0 * (1.0 - t));
                            buf[idx + 3] = (byte)Math.Max(0, Math.Min(255, newAlpha));
                        }
                        // Despill: clamp excess green so no neon-green halo remains
                        if (g > maxRB)
                        {
                            double avgRB = (r + b) * 0.5;
                            double clampedG = maxRB + (g - maxRB) * 0.15;
                            buf[idx + 1] = (byte)Math.Max(0, Math.Min(255, Math.Round(Math.Min(clampedG, avgRB + 22))));
                        }
                        if (bgNeighbors >= 6 && buf[idx + 3] < 90)
                        {
                            buf[idx + 3] = 0;
                        }
                    }
                    else if (gExcess > 24 && g > 110)
                    {
                        // Subtle global despill for stray JPEG green compression artifacts
                        buf[idx + 1] = (byte)Math.Max(0, Math.Min(255, Math.Round(maxRB + 12)));
                    }

                    if (buf[idx + 3] > 20)
                    {
                        if (x < minX) minX = x;
                        if (y < minY) minY = y;
                        if (x > maxX) maxX = x;
                        if (y > maxY) maxY = y;
                    }
                }
            }

            Marshal.Copy(buf, 0, data.Scan0, bytes);
            bmp.UnlockBits(data);

            if (maxX <= minX || maxY <= minY)
            {
                bmp.Save(outputPath, ImageFormat.Png);
                return;
            }

            // Step 3: Crop tightly with balanced square padding and high-quality resize
            int cw = maxX - minX + 1;
            int ch = maxY - minY + 1;
            int pad = (int)Math.Ceiling(Math.Max(cw, ch) * 0.05);
            int side = Math.Max(cw, ch) + pad * 2;

            using (var square = new Bitmap(side, side, PixelFormat.Format32bppArgb))
            {
                using (var sg = Graphics.FromImage(square))
                {
                    sg.Clear(Color.Transparent);
                    sg.CompositingQuality = CompositingQuality.HighQuality;
                    sg.InterpolationMode = InterpolationMode.HighQualityBicubic;
                    sg.SmoothingMode = SmoothingMode.HighQuality;
                    int ox = (side - cw) / 2;
                    int oy = side - ch - pad; // bottom-align slightly so all poses share consistent feet anchor!
                    sg.DrawImage(bmp, new Rectangle(ox, oy, cw, ch), new Rectangle(minX, minY, cw, ch), GraphicsUnit.Pixel);
                }

                using (var finalBmp = new Bitmap(targetSize, targetSize, PixelFormat.Format32bppArgb))
                {
                    using (var fg = Graphics.FromImage(finalBmp))
                    {
                        fg.Clear(Color.Transparent);
                        fg.CompositingQuality = CompositingQuality.HighQuality;
                        fg.InterpolationMode = pixelArt ? InterpolationMode.NearestNeighbor : InterpolationMode.HighQualityBicubic;
                        fg.SmoothingMode = pixelArt ? SmoothingMode.None : SmoothingMode.HighQuality;
                        fg.PixelOffsetMode = pixelArt ? PixelOffsetMode.Half : PixelOffsetMode.HighQuality;
                        fg.DrawImage(square, 0, 0, targetSize, targetSize);
                    }

                    // Final dark-background edge defringe on semi-transparent border pixels (preserves opaque cyan highlights)
                    var fRect = new Rectangle(0, 0, targetSize, targetSize);
                    var fData = finalBmp.LockBits(fRect, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
                    int fBytes = Math.Abs(fData.Stride) * targetSize;
                    byte[] fBuf = new byte[fBytes];
                    Marshal.Copy(fData.Scan0, fBuf, 0, fBytes);
                    for (int y = 0; y < targetSize; y++)
                    {
                        int row = y * fData.Stride;
                        for (int x = 0; x < targetSize; x++)
                        {
                            int idx = row + x * 4;
                            byte a = fBuf[idx + 3];
                            if (a == 0) continue;
                            byte b = fBuf[idx], g = fBuf[idx + 1], r = fBuf[idx + 2];
                            int maxRB = Math.Max(r, b);
                            if (a < 235 && g > maxRB)
                            {
                                if (a < 42 && (g - maxRB) > 8)
                                {
                                    fBuf[idx + 3] = 0;
                                }
                                else
                                {
                                    fBuf[idx + 1] = (byte)maxRB;
                                }
                            }
                        }
                    }
                    Marshal.Copy(fBuf, 0, fData.Scan0, fBytes);
                    finalBmp.UnlockBits(fData);

                    finalBmp.Save(outputPath, ImageFormat.Png);
                }
            }
        }
    }
}
"@

Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing

Get-ChildItem -Path $InputDir -File | Where-Object { $_.Extension -match '\.(jpg|jpeg|png)$' } | ForEach-Object {
  $outName = [System.IO.Path]::GetFileNameWithoutExtension($_.Name) + ".png"
  $outPath = Join-Path $OutputDir $outName
  Write-Host "Chroma-keying $($_.Name) -> $outName (pixelArt=$PixelArt)..."
  [ChromaKeyProcessor]::ProcessImage($_.FullName, $outPath, $TargetSize, [bool]$PixelArt)
}

# Also generate 64x64 tray icon from idle.png if present
$idlePng = Join-Path $OutputDir "idle.png"
$trayPng = Join-Path $OutputDir "tray-icon.png"
if (Test-Path $idlePng) {
  $src = [System.Drawing.Bitmap]::FromFile($idlePng)
  $dst = New-Object System.Drawing.Bitmap(64, 64, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($dst)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($src, 0, 0, 64, 64)
  $g.Dispose()
  $src.Dispose()
  $dst.Save($trayPng, [System.Drawing.Imaging.ImageFormat]::Png)
  $dst.Dispose()
  Write-Host "Generated tray icon: $trayPng"
}
