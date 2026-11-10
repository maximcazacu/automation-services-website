"""Build a static B2B release; unverified launch inputs block commercial output."""
import argparse
import json
import re
import shutil
import sys
from html import escape
from pathlib import Path
from tempfile import TemporaryDirectory

from launch import fact, origin_url, problems, render
from public_manifest import PUBLIC_FILES, PUBLIC_PAGES, ROOT
DEFAULT_LAUNCH = ROOT / ("launch.json" if (ROOT / "launch.json").is_file() else "launch.example.json")


def build(data, output, preview=False, base_path="/"):
    if not re.fullmatch(r"/(?:[A-Za-z0-9_-]+/)*", base_path):
        raise ValueError("base_path must be / or a slash-delimited path such as /automation-services-website/")
    if base_path != "/" and not preview:
        raise ValueError("Subdirectory hosting is supported for preview only")
    errors = problems(data)
    if errors and not preview:
        raise ValueError("BUILD COMERCIAL BLOCAT:\n- " + "\n- ".join(errors))
    origin = ""
    if fact(data, "origin"):
        try:
            origin = origin_url(fact(data, "origin"))
        except ValueError:
            pass
    with TemporaryDirectory(dir=output.parent) as temporary:
        release = Path(temporary) / "public"
        release.mkdir()
        for name in sorted(PUBLIC_FILES):
            shutil.copyfile(ROOT / name, release / name)
        for name in PUBLIC_PAGES:
            page = release / name
            document = render(page.read_text(encoding="utf-8"), data, preview)
            if not preview and re.search(r'De confirmat:|Preview ·|în curs de confirmare', document):
                raise ValueError(f"BUILD COMERCIAL BLOCAT: date neconfirmate în {name}")
            document = re.sub(r'\s*<meta name="robots"[^>]*>', '', document)
            route = "/" if name == "index.html" else "/" + name
            tags = '<meta name="robots" content="noindex, nofollow">' if preview else ""
            if origin:
                tags += f'\n  <link rel="canonical" href="{escape(origin + route, quote=True)}">'
                if name in ("index.html", "fluxclar-ops.html"):
                    tags += f'\n  <meta property="og:url" content="{escape(origin + route, quote=True)}">'
                    tags += f'\n  <meta property="og:image" content="{escape(origin, quote=True)}/fluxclar-social.png">\n  <meta name="twitter:card" content="summary_large_image">'
            document = document.replace('</head>', tags + '\n</head>', 1)
            document = document.replace('href="index.html', 'href="' + base_path)
            page.write_text(document, encoding="utf-8")
        email = fact(data, "email") or ("maximcazacu0501@mail.com" if preview else "")
        settings = {
            "AUTOMATION_CONTACT_EMAIL": email,
            "AUTOMATION_INQUIRY_ENDPOINT": "", "FLUXCLAR_LOCAL_API": False,
            "AUTOMATION_BOOKING_URL": "", "FLUXCLAR_PUBLIC_ORIGIN": origin,
            "FLUXCLAR_GA_MEASUREMENT_ID": "",
        }
        (release / "config.js").write_text("// Generated public settings; no private launch evidence.\n" + "\n".join(f"window.{key} = {json.dumps(value)};" for key, value in settings.items()) + "\n", encoding="utf-8")
        robots = "User-agent: *\nDisallow: /\n" if preview else f"User-agent: *\nAllow: /\nSitemap: {origin}/sitemap.xml\n"
        (release / "robots.txt").write_text(robots, encoding="utf-8")
        routes = ("/", "/fluxclar-ops.html", "/prestator.html", "/privacy.html", "/cookies.html") if origin and not preview else ()
        entries = "\n".join(f"  <url><loc>{escape(origin + route)}</loc></url>" for route in routes)
        (release / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + entries + '\n</urlset>\n', encoding="utf-8")
        release.rename(output)
    return errors


def main():
    # Windows pipes may otherwise fail while printing Romanian diagnostics.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--launch", type=Path, default=DEFAULT_LAUNCH)
    parser.add_argument("--out", type=Path, required=True, help="New directory; never overwrite a previous release.")
    parser.add_argument("--preview", action="store_true", help="Allow missing facts; mark every page noindex and visibly preview-only.")
    parser.add_argument("--base-path", default="/", help="Preview hosting prefix, including leading/trailing slash.")
    parser.add_argument("--origin", help="Optional assertion: must match the verified origin in the launch sheet.")
    args = parser.parse_args()
    output = args.out.resolve()
    if output.exists() or not output.parent.is_dir():
        parser.error("--out must be a new directory under an existing parent")
    try:
        data = json.loads(args.launch.read_text(encoding="utf-8-sig"))
        if args.origin and args.origin != fact(data, "origin"):
            raise ValueError("--origin must match the verified origin in the launch sheet; it cannot bypass approval")
        errors = build(data, output, args.preview, args.base_path)
    except (OSError, ValueError, TypeError, KeyError, AttributeError) as error:
        parser.exit(1, f"{error}\n")
    print(f"{'PREVIEW, NU PUBLICA COMERCIAL' if args.preview else 'Build B2B'}: {output}")
    if errors:
        print("Date lipsă pentru lansare:\n- " + "\n- ".join(errors))


if __name__ == "__main__":
    main()
