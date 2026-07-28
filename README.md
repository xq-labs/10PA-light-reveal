# AR Image-Tracking POC

A standalone Next.js proof-of-concept for image-target AR. Point your phone's
camera at a known printed frame and a personalized avatar image is overlaid on
the character's position, tracked in real time with [MindAR](https://github.com/hiukim/mind-ar-js)
+ [three.js](https://threejs.org/).

No backend, no database, no auth.

## Stack

- Next.js (App Router, TypeScript)
- Tailwind CSS (minimal styling)
- `mind-ar` (image tracking) + `three` (rendering)

## Getting started

```bash
npm install
npm run dev
```

Then open the printed page in front of your camera.

> Camera access requires a **secure context** (HTTPS). `localhost` counts, so
> `npm run dev` works on your own machine. To test on a phone, deploy a Vercel
> preview (it's HTTPS by default) and open the preview URL on the phone.

## Required: `/public/targets.mind`

This POC expects a compiled MindAR target file at **`/public/targets.mind`**
containing **2 targets (indices 0 and 1)**. It is not included — build it from
your 2 target images with the MindAR image compiler:

https://hiukim.github.io/mind-ar-js-doc/tools/compile

Drop the resulting `targets.mind` into `/public/`.

## Routes

- `/` — landing page with instructions and a link into the AR view.
- `/ar` — full-screen camera AR view (client-rendered only).
- `/ar?calibrate=true` — same, plus a floating panel to live-tune the currently
  tracked target's position/scale/rotation.

## Tuning avatar placement

1. Open `/ar?calibrate=true` and point the camera at a target.
2. Adjust `x / y / z / scale / rotationY` with the sliders (or +/−). The avatar
   updates live.
3. Tap **Log config** — it prints (and shows on screen) a `targetsConfig`
   snippet. Paste it into [`lib/targets.config.ts`](lib/targets.config.ts).

### Coordinate system

The tracked image is **1 unit wide**; origin `(0,0)` is its center. `+x` right,
`+y` up, `+z` toward the viewer. `scale` is the avatar plane width in those
units (`1` = as wide as the target image). `rotationY` is in degrees.

## Avatar overlays

Each frame has **two personalized variants** (`a` and `b`). Drop the four images
into `public/avatars/` (PNG with transparency recommended):

- Frame 0 (before / blue): `frame0-variant-a.png`, `frame0-variant-b.png`
- Frame 1 (after / red): `frame1-variant-a.png`, `frame1-variant-b.png`

To use different names/paths, update the `variants` entries in
[`lib/targets.config.ts`](lib/targets.config.ts).

Switch variants at runtime with the **Variant A/B** button in the AR view, or
deep-link with `?variant=a` / `?variant=b` (e.g. `/ar?variant=b`). The choice is
global — it applies to both frames.

## Deploy

Push to a Git repo and import into Vercel — no configuration needed. Make sure
`public/targets.mind` is committed so it ships with the deploy.
