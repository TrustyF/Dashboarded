Static Inter weights (400/500/600, Latin subset only), self-hosted via `next/font/local` in `app/layout.tsx`.

Downloaded from Google's legacy CSS API (which still returns genuine static
per-weight instances, unlike the modern css2 API `next/font/google` uses -
that one only ever serves Inter as a single variable font, which the Pi's
kiosk Chromium can't render):

```sh
curl -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Safari/537.36" \
  "https://fonts.googleapis.com/css?family=Inter:400,500,600&display=swap"
```

That prints one `@font-face` block per weight/unicode-range; take the URL
from each block whose `unicode-range` covers `U+0000-00FF` (the "latin"
subset) and `curl` it down to `Inter-<weight>.woff2`.

To add a weight: repeat the query, download the new file, add it to the
`src` array in `app/layout.tsx`, and use it via `font-weight` in a
`*.module.sass` file.
