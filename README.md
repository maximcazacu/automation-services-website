# Automation services website — redesign workspace

Romanian B2B website for Maxim Cazacu: Copilot Studio agents, Microsoft 365 workflows, and Excel reporting. This repository provides the current frontend as input for a new design.

**The existing “FluxClar” name and visual identity have been rejected by the project owner. They remain in this snapshot only as the current state to replace. Do not treat them as the approved brand, reuse them in the new identity, or launch this version commercially.** See [REDESIGN.md](REDESIGN.md).

- [Live redesign preview](https://maximcazacu.github.io/automation-services-website/)
- Main page: `index.html`
- Retail pilot: `fluxclar-ops.html`
- Shared styles and behavior: `style.css`, `ops.css`, `site.js`
- Provider, privacy and browser-storage pages: `prestator.html`, `privacy.html`, `cookies.html`

## Preview locally

Python 3.10+; no build dependencies:

```sh
python build_public.py --preview --out preview-review
python -m http.server 8080 --bind 127.0.0.1 --directory preview-review
```

Open `http://127.0.0.1:8080`. Use a new output directory for each build.

## GitHub Pages

The Pages workflow validates the build and publishes only the static allowlist. It uses:

```sh
python -m unittest test_release -v
python build_public.py --preview --base-path /automation-services-website/ --out _site
```

Every page is visibly labelled as an unapproved redesign preview and carries `noindex, nofollow`. This is a public reference preview; indexing directives are not access controls. No custom domain is configured.

The contact form prepares a draft for the visitor's mail application. It does not submit data to an API. GA4, external bookings, demo persistence and consent storage are disabled. The current public contact address is retained from the frontend snapshot.

## Launch information

`launch.example.json` is an empty template with no approvals. A local `launch.json` is ignored by Git and can be supplied separately. Commercial builds fail until the required facts and evidence are completed. Branding must also be replaced and reviewed before launch.

The repository and deployment exclude databases, credentials, the local admin application, the local Python inquiry server, private launch evidence and working files. Existing font license files are included; no new license or brand clearance is implied.

## Tests

```sh
python -m unittest test_release -v
```

For optional browser checks, install/resolve Playwright in your development environment and point `FLUXCLAR_BROWSER` to a Chromium-based browser if necessary:

```sh
node test_browser.cjs _site work/browser-evidence /automation-services-website/
```

The local mock API used by browser tests is only a regression fixture, not a deployed backend.
