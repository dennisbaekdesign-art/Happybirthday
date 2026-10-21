# Happy Birthday, Yujin

A single illustrated birthday card based on the supplied `claude-v1.html`. The girl follows the **rightmost panel of the supplied three-panel reference**, as confirmed by the user.

## Shared HTML preview

[Open the interactive prototype](https://htmlpreview.github.io/?https://raw.githubusercontent.com/dennisbaekdesign-art/Happybirthday/main/index.html)

This URL uses the third-party GitHub HTML Preview service to run the public HTML from `main`. It can be shared without keeping the local development server running. The public source returned HTTP 200 and matched the local file; the preview loader was tested locally through the complete candle-to-letter sequence. Access to the preview host itself was blocked by the cloud environment network policy, so availability of the external URL has not been independently verified here. A dedicated static host is still the documented path for a production deployment.

## Open or run

`index.html` is self-contained: the illustration, handwritten letter, and subset of the Gaegu font are embedded. It works directly as a file, or on any static HTTPS host. No runtime packages, API keys, microphone, or build step are required.

For a local development server with Node.js 18 or newer:

```sh
npm start
```

The server listens on port 8000 on all interfaces. Set `PORT` to change it. The server is for development; publish `index.html` and `FONT-LICENSE.txt` on a static host for a shareable mobile URL. A local server address is not a public link.

## Interactions retained

- Staggered candle ignition and expanding candlelight.
- Birthday greeting, followed by the wish prompt.
- Tap the illustration to blow; Space or Enter also works when the page body has focus. The hint is also tappable.
- Device orientation influences the flames when the browser permits it. Permission denial does not block tapping. HTTPS is recommended for motion sensor support.
- Wind, puckered expression, lowering hands, staggered extinguishing, smoke, confetti, and a happy expression.
- Darkness transitions into the original handwritten letter, followed by the Korean replay button.

The supplied HTML did not contain microphone input or a dog; neither has been introduced as an unrelated feature.

## Animation changes

The existing canvas story is retained. One character rig continuously interpolates its eyelids and mouth, keeps hands in the scene behind the cake, and adds spring-driven follow-through to the reference's two-part side bun. Stable pigment texture follows the artwork. Static drawing parts are cached, rendering is capped at 2× device resolution, and secondary motion is reduced for the system reduced-motion preference.

A shared active-time clock drives the original sequence and physics, pausing both when the page is hidden. The intro lighting continues through its intended duration instead of stopping when the title appears. Replay fades the old letter before resetting the scene. Resizing does not restart the story.

## Browser checks

```sh
npm ci
npx playwright install chromium
npm test
```

If Chromium is already installed, set `CHROMIUM_PATH`; `/usr/bin/chromium` is detected automatically. The test starts its own server on port 4173, exercises the full story and replay, keyboard input, tilt smoothing, denied motion permissions, background pausing, reduced motion, and five viewport sizes. Screenshots are written to ignored `artifacts/`.

These are Chromium checks with simulated phone viewports, not physical-device or Safari certification.

## Publishing

Upload `index.html` and `FONT-LICENSE.txt` to an HTTPS static host. For GitHub Pages, commit these files to a branch, enable Pages for that branch and the repository root in Settings → Pages, and use the URL GitHub reports after the deployment completes. Do not treat a proposed Pages URL as deployed until its HTTP response is verified.

## Credits

Gaegu Bold: Copyright (c) 2017, JIKJI SOFT. The embedded font is a subset under the SIL Open Font License 1.1. See `FONT-LICENSE.txt`; the license is also included in the HTML for standalone distribution. Original letter asset and interaction sequence come from the user's supplied HTML.
