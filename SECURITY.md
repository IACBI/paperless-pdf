# Security Policy

## Supported versions

Only the latest version is supported: the `main` branch, and the site deployed from it at
<https://iacbi.github.io/paperless-pdf/>. Older deployments and branches do not receive fixes.

## Reporting a vulnerability

Please report security issues privately. Do not open a public issue or pull request for them.

Use GitHub's private vulnerability reporting form:
<https://github.com/IACBI/paperless-pdf/security/advisories/new>

Include the steps to reproduce the problem, the browser and its version, and a sample file if
the problem depends on one. Please do not send real personal documents. A minimal reproduction
is enough.

Fixes land on `main`, and the site is redeployed from there.

## Scope

In scope:

- Any code path that sends user data (files, page images, extracted text, OCR output) off the
  device, or makes a request that carries it. The privacy invariant described in `CLAUDE.md` is
  the core security property of this project.
- A way to bypass the Content Security Policy in `index.html`, or to load scripts, workers or
  other assets from a foreign origin.
- A crafted PDF, image or language file that crashes, hangs or exhausts the memory of the tab
  beyond the limits in `src/lib/limits.ts`.
- Cross-site scripting or injection in the app's own UI.
- Tampering with the self-hosted OCR assets, including a way around the SHA-256 check in
  `scripts/vendor-tesseract.mjs`.

Out of scope:

- Issues that require a compromised browser, operating system or browser extension, or physical
  access to the device.
- Flaws in third-party engines (`pdf-lib`, `pdf.js`, `tesseract.js`) that this app does not
  expose. Please report those upstream.
- Denial of service that needs a file larger than the documented limits, which the app rejects
  by design.
- Missing security headers on a static host that you control. This app is served as static files
  and enforces its CSP in the page itself.
- Reports produced only by automated scanners, without a demonstrated impact.
