param(
  [string]$ProjectRoot = (Resolve-Path "$PSScriptRoot\..").Path
)

Add-Type -AssemblyName System.Drawing

$classicDir = Join-Path $ProjectRoot "assets\skins\catgirl-classic"
$legacyDir  = Join-Path $ProjectRoot "assets\sprites"
$pixelDir   = Join-Path $ProjectRoot "assets\skins\pixel-retro"
$argonDir   = Join-Path $ProjectRoot "assets\skins\catgirl-argon"

New-Item -ItemType Directory -Force -Path $classicDir, $pixelDir, $argonDir | Out-Null

# Ensure classic skin has all 5 PNGs copied from assets/sprites
foreach ($st in @("idle", "working", "happy", "sweat", "poked")) {
  $src = Join-Path $legacyDir "$st.png"
  $dst = Join-Path $classicDir "$st.png"
  if ((Test-Path $src) -and (-not (Test-Path $dst))) {
    Copy-Item -Force $src $dst
  }
}

$code = @"
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class SkinVariantBuilder
{
    public static void BuildPixelArt(string inputPath, string outputPath, int gridSize, int outSize)
    {
        using (var src = new Bitmap(inputPath))
        using (var small = new Bitmap(gridSize, gridSize, PixelFormat.Format32bppArgb))
        {
            using (var g = Graphics.FromImage(small))
            {
                g.Clear(Color.Transparent);
                g.InterpolationMode = InterpolationMode.HighQualityBilinear;
                g.DrawImage(src, 0, 0, gridSize, gridSize);
            }

            // Hard-alpha + retro 16-bit palette quantization
            for (int y = 0; y < gridSize; y++)
            {
                for (int x = 0; x < gridSize; x++)
                {
                    Color c = small.GetPixel(x, y);
                    if (c.A < 115)
                    {
                        small.SetPixel(x, y, Color.Transparent);
                    }
                    else
                    {
                        int r = ((c.R + 16) / 32) * 32;
                        int gr = ((c.G + 16) / 32) * 32;
                        int b = ((c.B + 16) / 32) * 32;
                        r = Math.Min(255, Math.Max(0, r));
                        gr = Math.Min(255, Math.Max(0, gr));
                        b = Math.Min(255, Math.Max(0, b));
                        small.SetPixel(x, y, Color.FromArgb(255, r, gr, b));
                    }
                }
            }

            // Add crisp 1-pixel retro dark indigo outline around silhouette
            bool[,] solid = new bool[gridSize, gridSize];
            for (int y = 0; y < gridSize; y++)
                for (int x = 0; x < gridSize; x++)
                    solid[x, y] = small.GetPixel(x, y).A > 0;

            Color outline = Color.FromArgb(255, 24, 20, 48);
            for (int y = 0; y < gridSize; y++)
            {
                for (int x = 0; x < gridSize; x++)
                {
                    if (solid[x, y]) continue;
                    bool adj =
                        (x > 0 && solid[x - 1, y]) ||
                        (x < gridSize - 1 && solid[x + 1, y]) ||
                        (y > 0 && solid[x, y - 1]) ||
                        (y < gridSize - 1 && solid[x, y + 1]);
                    if (adj)
                    {
                        small.SetPixel(x, y, outline);
                    }
                }
            }

            using (var big = new Bitmap(outSize, outSize, PixelFormat.Format32bppArgb))
            {
                using (var g = Graphics.FromImage(big))
                {
                    g.Clear(Color.Transparent);
                    g.InterpolationMode = InterpolationMode.NearestNeighbor;
                    g.SmoothingMode = SmoothingMode.None;
                    g.PixelOffsetMode = PixelOffsetMode.Half;
                    g.DrawImage(small, 0, 0, outSize, outSize);
                }
                big.Save(outputPath, ImageFormat.Png);
            }
        }
    }

    private static void RgbToHsl(byte rByte, byte gByte, byte bByte, out double h, out double s, out double l)
    {
        double r = rByte / 255.0, g = gByte / 255.0, b = bByte / 255.0;
        double max = Math.Max(r, Math.Max(g, b));
        double min = Math.Min(r, Math.Min(g, b));
        l = (max + min) / 2.0;
        if (Math.Abs(max - min) < 1e-6)
        {
            h = 0; s = 0;
        }
        else
        {
            double d = max - min;
            s = l > 0.5 ? d / (2.0 - max - min) : d / (max + min);
            if (max == r) h = (g - b) / d + (g < b ? 6 : 0);
            else if (max == g) h = (b - r) / d + 2;
            else h = (r - g) / d + 4;
            h *= 60.0;
        }
    }

    private static double Hue2Rgb(double p, double q, double t)
    {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1.0 / 6.0) return p + (q - p) * 6.0 * t;
        if (t < 1.0 / 2.0) return q;
        if (t < 2.0 / 3.0) return p + (q - p) * (2.0 / 3.0 - t) * 6.0;
        return p;
    }

    private static void HslToRgb(double h, double s, double l, out byte r, out byte g, out byte b)
    {
        double rd, gd, bd;
        if (s < 1e-6)
        {
            rd = gd = bd = l;
        }
        else
        {
            double q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            double p = 2 * l - q;
            double hk = ((h % 360.0) + 360.0) % 360.0 / 360.0;
            rd = Hue2Rgb(p, q, hk + 1.0 / 3.0);
            gd = Hue2Rgb(p, q, hk);
            bd = Hue2Rgb(p, q, hk - 1.0 / 3.0);
        }
        r = (byte)Math.Max(0, Math.Min(255, Math.Round(rd * 255.0)));
        g = (byte)Math.Max(0, Math.Min(255, Math.Round(gd * 255.0)));
        b = (byte)Math.Max(0, Math.Min(255, Math.Round(bd * 255.0)));
    }

    // Selective Cyber-Argon Neon Grade: shifts cool blues/purples toward luminous violet-magenta-cyan while preserving warm peach skin tones
    public static void BuildArgonNeon(string inputPath, string outputPath)
    {
        using (var srcOrig = new Bitmap(inputPath))
        using (var bmp = new Bitmap(srcOrig.Width, srcOrig.Height, PixelFormat.Format32bppArgb))
        {
            using (var g = Graphics.FromImage(bmp)) { g.DrawImage(srcOrig, 0, 0, srcOrig.Width, srcOrig.Height); }
            int w = bmp.Width, h = bmp.Height;
            var rect = new Rectangle(0, 0, w, h);
            var data = bmp.LockBits(rect, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
            int bytes = Math.Abs(data.Stride) * h;
            byte[] buf = new byte[bytes];
            Marshal.Copy(data.Scan0, buf, 0, bytes);

            for (int y = 0; y < h; y++)
            {
                int row = y * data.Stride;
                for (int x = 0; x < w; x++)
                {
                    int idx = row + x * 4;
                    byte a = buf[idx + 3];
                    if (a == 0) continue;

                    byte b = buf[idx], gCol = buf[idx + 1], r = buf[idx + 2];
                    double hue, sat, lum;
                    RgbToHsl(r, gCol, b, out hue, out sat, out lum);

                    // Protect warm skin / gold eyes (hue 0..55 & high lightness)
                    bool isSkinOrGold = (hue >= 0 && hue <= 52 && lum > 0.42);
                    if (!isSkinOrGold && sat > 0.14)
                    {
                        if (hue >= 175 && hue <= 265)
                        {
                            // Shift blue/indigo hair & dress toward vibrant Argon neon violet-magenta
                            hue = hue + 58.0;
                            sat = Math.Min(1.0, sat * 1.18);
                            lum = Math.Min(0.92, lum * 1.05);
                        }
                        else if (hue > 265 && hue <= 345)
                        {
                            // Shift purples/pinks toward electric cyan-violet highlights
                            hue = hue + 28.0;
                            sat = Math.Min(1.0, sat * 1.15);
                        }
                        byte nr, ng, nb;
                        HslToRgb(hue, sat, lum, out nr, out ng, out nb);
                        buf[idx] = nb;
                        buf[idx + 1] = ng;
                        buf[idx + 2] = nr;
                    }
                }
            }

            Marshal.Copy(buf, 0, data.Scan0, bytes);
            bmp.UnlockBits(data);
            bmp.Save(outputPath, ImageFormat.Png);
        }
    }
}
"@

Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing

foreach ($st in @("idle", "working", "happy", "sweat", "poked")) {
  $src = Join-Path $classicDir "$st.png"
  if (-not (Test-Path $src)) { continue }
  Write-Host "Building pixel-retro & catgirl-argon for state: $st"
  [SkinVariantBuilder]::BuildPixelArt($src, (Join-Path $pixelDir "$st.png"), 54, 320)
  [SkinVariantBuilder]::BuildArgonNeon($src, (Join-Path $argonDir "$st.png"))
}
Write-Host "Done building pixel-retro and catgirl-argon skins!"
