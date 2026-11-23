param(
  [int]$WidgetPid = 0,
  [string]$TargetProcess = "Antigravity",
  [int]$IntervalMs = 180
)

$ErrorActionPreference = "SilentlyContinue"

$cs = @"
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;

public class AgyWindowTracker
{
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("dwmapi.dll")]
    private static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out RECT pvAttribute, int cbAttribute);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    public class Snapshot
    {
        public bool Found;
        public bool Minimized;
        public bool Foreground;
        public bool WidgetForeground;
        public int Left;
        public int Top;
        public int Width;
        public int Height;
        public uint Pid;
    }

    private static RECT GetAccurateRect(IntPtr hWnd)
    {
        RECT r;
        const int DWMWA_EXTENDED_FRAME_BOUNDS = 9;
        int hr = DwmGetWindowAttribute(hWnd, DWMWA_EXTENDED_FRAME_BOUNDS, out r, Marshal.SizeOf(typeof(RECT)));
        if (hr == 0 && (r.Right - r.Left) > 0 && (r.Bottom - r.Top) > 0)
        {
            return r;
        }
        GetWindowRect(hWnd, out r);
        return r;
    }

    public static Snapshot Query(string targetName, int widgetPid)
    {
        var snap = new Snapshot();
        var targetPids = new HashSet<uint>();
        try
        {
            var procs = Process.GetProcessesByName(targetName);
            foreach (var p in procs)
            {
                try { targetPids.Add((uint)p.Id); } catch { }
                finally { p.Dispose(); }
            }
        }
        catch { }

        if (targetPids.Count == 0)
        {
            return snap;
        }

        IntPtr fgHwnd = GetForegroundWindow();
        uint fgPid = 0;
        if (fgHwnd != IntPtr.Zero)
        {
            GetWindowThreadProcessId(fgHwnd, out fgPid);
        }

        snap.WidgetForeground = (widgetPid > 0 && fgPid == (uint)widgetPid);
        bool targetIsFg = targetPids.Contains(fgPid);
        snap.Foreground = targetIsFg || snap.WidgetForeground;

        IntPtr bestHwnd = IntPtr.Zero;
        RECT bestRect = new RECT();
        long bestArea = -1;
        bool bestIconic = true;
        uint bestPid = 0;

        EnumWindows((hWnd, lParam) =>
        {
            if (!IsWindowVisible(hWnd)) return true;
            uint pid;
            GetWindowThreadProcessId(hWnd, out pid);
            if (!targetPids.Contains(pid)) return true;

            bool iconic = IsIconic(hWnd);
            RECT r = GetAccurateRect(hWnd);
            int w = r.Right - r.Left;
            int h = r.Bottom - r.Top;

            // Skip hidden helper / zero-sized / tiny tooltip windows unless iconic
            if (!iconic && (w < 300 || h < 220)) return true;

            long area = iconic ? 0 : (long)w * (long)h;
            bool isFgWindow = (hWnd == fgHwnd);

            if (isFgWindow && !iconic)
            {
                bestHwnd = hWnd;
                bestRect = r;
                bestArea = long.MaxValue;
                bestIconic = false;
                bestPid = pid;
                return false;
            }

            if (bestHwnd == IntPtr.Zero || (!iconic && bestIconic) || (!iconic && area > bestArea))
            {
                bestHwnd = hWnd;
                bestRect = r;
                bestArea = area;
                bestIconic = iconic;
                bestPid = pid;
            }
            return true;
        }, IntPtr.Zero);

        if (bestHwnd != IntPtr.Zero)
        {
            snap.Found = true;
            snap.Minimized = bestIconic;
            snap.Left = bestRect.Left;
            snap.Top = bestRect.Top;
            snap.Width = Math.Max(0, bestRect.Right - bestRect.Left);
            snap.Height = Math.Max(0, bestRect.Bottom - bestRect.Top);
            snap.Pid = bestPid;
        }
        return snap;
    }
}
"@

Add-Type -TypeDefinition $cs -Language CSharp

$lastJson = ""
while ($true) {
  if ($WidgetPid -gt 0) {
    $parentAlive = Get-Process -Id $WidgetPid -ErrorAction SilentlyContinue
    if (-not $parentAlive) { break }
  }

  $s = [AgyWindowTracker]::Query($TargetProcess, $WidgetPid)
  $json = "{`"found`":$($s.Found.ToString().ToLower()),`"minimized`":$($s.Minimized.ToString().ToLower()),`"foreground`":$($s.Foreground.ToString().ToLower()),`"widgetForeground`":$($s.WidgetForeground.ToString().ToLower()),`"x`":$($s.Left),`"y`":$($s.Top),`"width`":$($s.Width),`"height`":$($s.Height),`"pid`":$($s.Pid)}"
  if ($json -ne $lastJson) {
    [Console]::Out.WriteLine($json)
    [Console]::Out.Flush()
    $lastJson = $json
  }
  Start-Sleep -Milliseconds $IntervalMs
}
