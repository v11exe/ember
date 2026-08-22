using System;
using System.Globalization;
using System.Runtime.InteropServices;

internal static class EmberAccentBlur
{
    private const int AccentDisabled = 0;
    private const int AccentAcrylic = 4;
    private const int AccentPolicyAttribute = 19;

    [StructLayout(LayoutKind.Sequential)] private struct Policy { public int State; public int Flags; public int Color; public int Animation; }
    [StructLayout(LayoutKind.Sequential)] private struct AttributeData { public int Attribute; public IntPtr Data; public IntPtr Size; }
    [StructLayout(LayoutKind.Sequential)] private struct Margins { public int Left; public int Right; public int Top; public int Bottom; }

    [DllImport("user32.dll", SetLastError = true)] private static extern bool SetWindowCompositionAttribute(IntPtr hwnd, ref AttributeData data);
    [DllImport("dwmapi.dll")] private static extern int DwmExtendFrameIntoClientArea(IntPtr hwnd, ref Margins margins);

    private static int Color(string value)
    {
        return unchecked((int)UInt32.Parse(value, NumberStyles.AllowHexSpecifier, CultureInfo.InvariantCulture));
    }

    private static int Main(string[] args)
    {
        try
        {
            if (args.Length != 3) throw new ArgumentException("Expected hwnd, mode, and ARGB tint.");
            var hwnd = new IntPtr(long.Parse(args[0], CultureInfo.InvariantCulture));
            var enabled = String.Equals(args[1], "accent", StringComparison.OrdinalIgnoreCase);
            var policy = new Policy { State = enabled ? AccentAcrylic : AccentDisabled, Color = Color(args[2]) };
            var size = Marshal.SizeOf(typeof(Policy));
            var memory = Marshal.AllocHGlobal(size);
            try
            {
                Marshal.StructureToPtr(policy, memory, false);
                var data = new AttributeData { Attribute = AccentPolicyAttribute, Data = memory, Size = new IntPtr(size) };
                var applied = SetWindowCompositionAttribute(hwnd, ref data);
                if (enabled)
                {
                    var margins = new Margins { Left = -1, Right = -1, Top = -1, Bottom = -1 };
                    if (DwmExtendFrameIntoClientArea(hwnd, ref margins) != 0) applied = false;
                }
                return applied ? 0 : 1;
            }
            finally { Marshal.FreeHGlobal(memory); }
        }
        catch (Exception error) { Console.Error.WriteLine(error.Message); return 1; }
    }
}
