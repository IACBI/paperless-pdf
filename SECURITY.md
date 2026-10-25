# Security Policy

## Supported versions

Only the latest version is supported. That is the `main` branch and the site
deployed from it at <https://iacbi.github.io/paperless-pdf/>. Older deployments
and branches receive no fixes.

## Reporting a vulnerability

Please report privately. Do not open a public issue or pull request for a
security problem.

Use GitHub's **Report a vulnerability** button (private vulnerability reporting)
on the repository's Security tab: <https://github.com/IACBI/paperless-pdf/security>.
Include the steps to reproduce, the browser and version, and a sample file if the
problem needs one. Do not send real personal documents; a minimal reproduction is
enough.

Fixes land on `main`, and the site is redeployed from there.

## Scope

In scope:

- Any path that sends user data (files, page images, extracted text, OCR output)
  off the device, or that makes a request carrying it. The privacy invariant in
  `CLAUDE.md` is the core security property of this project.
- A bypass of the Content Security Policy in `index.html`, or a way to load
  scripts, workers, or other assets from a foreign origin.
- A crafted PDF, image, or language file that crashes the tab, hangs it, or
  exhausts memory beyond the limits in `src/lib/limits.ts`.
- Cross-site scripting or injection in the app's own UI.
- Tampering with the self-hosted OCR assets, including a way around the SHA-256
  check in `scripts/vendor-tesseract.mjs`.

Out of scope:

- Issues that require a compromised browser, operating system, or browser
  extension, or physical access to the device.
- Problems in third-party engines (`pdf-lib`, `pdf.js`, `tesseract.js`) that are
  not reachable through this app. Report those upstream.
- Denial of service that needs a file larger than the documented limits and is
  rejected as designed.
- Missing security headers on a static host you control. This app is served as
  static files and enforces its CSP in the page itself.
- Reports generated only by automated scanners, without a demonstrated impact.
