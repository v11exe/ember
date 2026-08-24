using System;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Threading;

// Waits for a modifier key to come back up, and says so on stdout.
//
// Ember needs this because nothing inside the browser can be relied on to
// report it. A `BaseWindow` routes keys between its `WebContentsView`s in a way
// that does not follow `webContents.focus()`, and a sandboxed page view does
// not surface a modifier's key-up through `before-input-event` at all — so a
// Ctrl+Tab chord could be released with no part of Ember ever hearing about it,
// leaving the switcher on screen. The keyboard state itself is never ambiguous,
// so it is asked directly.
//
// Arguments: virtual-key code, poll interval in ms, timeout in ms.
// Exit 0 with "up" printed when the key is released; exit 2 on timeout.
internal static class EmberKeyWatch
{
    [DllImport("user32.dll")] private static extern short GetAsyncKeyState(int key);

    private static bool Down(int key)
    {
        return (GetAsyncKeyState(key) & 0x8000) != 0;
    }

    private static int Main(string[] args)
    {
        try
        {
            if (args.Length != 3) throw new ArgumentException("Expected a virtual-key code, a poll interval, and a timeout.");
            var key = int.Parse(args[0], CultureInfo.InvariantCulture);
            var interval = Math.Max(5, int.Parse(args[1], CultureInfo.InvariantCulture));
            var timeout = Math.Max(interval, int.Parse(args[2], CultureInfo.InvariantCulture));

            // The chord may already have been released between Ember deciding to
            // watch and this process starting, so the state is read before any
            // waiting rather than after.
            var waited = 0;
            while (waited < timeout)
            {
                if (!Down(key))
                {
                    Console.Out.WriteLine("up");
                    Console.Out.Flush();
                    return 0;
                }
                Thread.Sleep(interval);
                waited += interval;
            }
            return 2;
        }
        catch (Exception error)
        {
            Console.Error.WriteLine(error.Message);
            return 1;
        }
    }
}
