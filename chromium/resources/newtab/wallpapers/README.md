# Ember default wallpapers

The approved Smoked Glass, Ember Glow and Frosted Landscape artwork is bundled
as the original lossless PNG files, each 1672 × 941 pixels. They contain only
background artwork: Ember's genuine logo, search field and browser controls are
rendered separately at the display's native resolution. No screenshot mockup or
artificially enlarged image is shipped.

These images were generated with OpenAI's built-in image generation tool for
Ember on 5 November 2026 and approved by the user. The directions were neutral
smoked glass with broad soft planes, charcoal with a restrained copper glow,
and a frosted misty mountain lake. Each composition leaves a quiet centre for
the existing logo and search.

`manifest.json` maps the three images into the existing New Tab resource
directory. Its WebUI build includes them in the browser resource pack. Images
stay local and use the same centred `cover` crop and viewport-aligned search
lens as Unsplash. Ember Glow is the default when Unsplash and translucency are
off, and is also the safe fallback for an unknown wallpaper preference.
