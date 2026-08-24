using System;
using System.Globalization;
using System.Runtime.InteropServices;

// Re-asserts a window's rounded-corner preference.
//
// Electron sets DWMWA_WINDOW_CORNER_PREFERENCE once, when the window is built,
// and exposes no way to set it again. Ember draws no corner of its own — the
// curve is entirely DWM's — so if anything clears that preference the window
// simply goes square, with nothing in Ember able to notice or undo it. This
// puts it back.
//
// Arguments: hwnd, and "round" or "default".
internal static class EmberWindowCorners
{
    private const int DWMWA_WINDOW_CORNER_PREFERENCE = 33;
    private const int DWMWCP_DEFAULT = 0;
    private const int DWMWCP_ROUND = 2;

    [DllImport("dwmapi.dll")]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attribute, ref int value, int size);

    private static int Main(string[] args)
    {
        try
        {
            if (args.Length != 2) throw new ArgumentException("Expected a window handle and a corner preference.");
            var hwnd = new IntPtr(long.Parse(args[0], CultureInfo.InvariantCulture));
            var preference = String.Equals(args[1], "round", StringComparison.OrdinalIgnoreCase)
                ? DWMWCP_ROUND
                : DWMWCP_DEFAULT;
            var result = DwmSetWindowAttribute(hwnd, DWMWA_WINDOW_CORNER_PREFERENCE, ref preference, sizeof(int));
            return result == 0 ? 0 : 1;
        }
        catch (Exception error)
        {
            Console.Error.WriteLine(error.Message);
            return 1;
        }
    }
}
