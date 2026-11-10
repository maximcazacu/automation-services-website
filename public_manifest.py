"""Explicit static B2B release boundary, shared with the local preview server."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PUBLIC_PAGES = ("index.html", "fluxclar-ops.html", "prestator.html", "privacy.html", "cookies.html")
PUBLIC_FILES = set(PUBLIC_PAGES) | {
    "style.css", "ops.css", "site.js", "config.js", "favicon.svg",
    "fluxclar-on-dark.svg", "fluxclar-on-light.svg", "fluxclar-flow.png", "fluxclar-social.png",
    "BricolageGrotesque-Bold.ttf", "InstrumentSans-Regular.ttf", "InstrumentSans-Bold.ttf",
    "BricolageGrotesque-OFL.txt", "InstrumentSans-OFL.txt",
}
