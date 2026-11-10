"""Release regression checks. All approved values below are synthetic test fixtures."""
import copy
import json
import re
import tempfile
import unittest
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

from build_public import build, DEFAULT_LAUNCH
from launch import LABELS, fact, problems
from public_manifest import PUBLIC_FILES, PUBLIC_PAGES, ROOT


def fixture():
    # Never use this object as a launch sheet; temporary test output is deleted.
    data = json.loads(DEFAULT_LAUNCH.read_text(encoding="utf-8"))
    data["facts"] = {key: {"value": "TEST SINTETIC", "verified": True, "evidence": "TEST ONLY"} for key in LABELS}
    for key, value in {"origin": "https://fluxclar-review-fixture.ro", "legal_form": "SRL", "email": "review@example.org", "phone": "+40000000000", "requests_mode": "email"}.items():
        data["facts"][key]["value"] = value
    data["providers"] = [{"verified": True, **{key: "TEST SINTETIC" for key in ("name", "role", "data", "location", "transfers", "safeguards", "evidence")}, "service": service} for service in ("hosting", "email")]
    data["approval"] = {"by": "TEST ONLY", "date": "2026-11-10", "evidence": "TEST ONLY"}
    return data


class HTML(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.ids, self.links, self.canonicals, self.scripts = set(), [], [], []
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if "id" in a:
            if a["id"] in self.ids:
                raise AssertionError("Duplicate ID: " + a["id"])
            self.ids.add(a["id"])
        for key in ("href", "src"):
            if key in a:
                self.links.append(a[key])
        if tag == "link" and a.get("rel") == "canonical":
            self.canonicals.append(a["href"])
        if tag == "script":
            self.scripts.append(a.get("src"))


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        (ROOT / 'work').mkdir(exist_ok=True)
        self.tmp = tempfile.TemporaryDirectory(dir=ROOT / 'work')
        self.addCleanup(self.tmp.cleanup)
        self.out = Path(self.tmp.name) / "release"

    def test_missing_facts_block_commercial_without_output(self):
        data = json.loads(DEFAULT_LAUNCH.read_text(encoding="utf-8"))
        with self.assertRaisesRegex(ValueError, "BUILD COMERCIAL BLOCAT"):
            build(data, self.out)
        self.assertFalse(self.out.exists())

    def test_each_required_fact_and_evidence_is_enforced(self):
        for key in LABELS:
            for part in ("value", "evidence", "verified"):
                data = fixture()
                data["facts"][key][part] = False if part == "verified" else ""
                self.assertTrue(problems(data), (key, part))

    def test_unverified_values_never_appear_in_preview(self):
        data = json.loads(DEFAULT_LAUNCH.read_text(encoding="utf-8"))
        data["facts"]["legal_name"]["value"] = "UNVERIFIED_SECRET_VALUE"
        build(data, self.out, preview=True)
        for name in PUBLIC_PAGES:
            content = (self.out/name).read_text(encoding="utf-8")
            self.assertNotIn("UNVERIFIED_SECRET_VALUE", content)
            self.assertIn('noindex, nofollow', content)
            self.assertIn('Preview pentru review', content)
            self.assertNotIn('rel="canonical"', content)
        self.assertIn('Disallow: /', (self.out/'robots.txt').read_text())

    def test_feature_and_api_gates(self):
        changes = [lambda d: d["public_api"].update(authorized=True, endpoint="/api/inquiries"),
                   lambda d: d["facts"]["requests_mode"].update(value="api"),
                   lambda d: d.update(providers=[]), lambda d: d.update(approval={})]
        changes += [lambda d, k=k: d["optional_features"].update({k: True}) for k in ("ga4", "demo_storage", "external_booking")]
        for change in changes:
            data = fixture()
            change(data)
            self.assertTrue(problems(data))

    def test_origin_and_email_validation(self):
        for bad in ('http://a.ro', 'https://example.com', 'https://x.test', 'https://x.ro/path', 'https://u:p@x.ro', 'https://x.ro:443', 'https://127.0.0.1'):
            data = fixture()
            data['facts']['origin']['value'] = bad
            self.assertTrue(problems(data), bad)
        data['facts']['email']['value'] = 'bad\nmail@example.org'
        self.assertTrue(problems(data))

    def test_clean_build_routes_links_metadata_and_allowlist(self):
        data = fixture()
        self.assertEqual(problems(data), [])
        build(data, self.out)
        self.assertEqual({p.name for p in self.out.iterdir()}, PUBLIC_FILES | {'robots.txt','sitemap.xml'})
        pages = {name: HTML((self.out/name).read_text(encoding='utf-8')) for name in PUBLIC_PAGES}
        footers = []
        for name, parsed in pages.items():
            text = (self.out/name).read_text(encoding='utf-8')
            self.assertNotRegex(text, r'Preview|De confirmat:|refund-policy|analytics.js|cookies.js|booking-link')
            route = '/' if name == 'index.html' else '/' + name
            self.assertEqual(parsed.canonicals, [fact(data,'origin') + route])
            footers.append(re.search(r'<footer.*?</footer>',text,re.S)[0])
            for target in parsed.links:
                url = urlsplit(target)
                if url.scheme or url.netloc:
                    continue
                path = unquote(url.path).lstrip('/') or (name if target.startswith('#') else 'index.html')
                self.assertTrue((self.out/path).is_file(), (name,target))
                if url.fragment and path in pages:
                    self.assertIn(unquote(url.fragment), pages[path].ids, (name,target))
        self.assertEqual(len(set(footers)),1)
        self.assertNotIn('TEST ONLY', '\n'.join(p.read_text(encoding='utf-8') for p in self.out.glob('*.html')))
        self.assertNotIn('maximcazacu0501', (self.out/'index.html').read_text(encoding='utf-8'))
        for name in PUBLIC_PAGES:
            route = '/' if name == 'index.html' else '/' + name
            self.assertIn(f'<loc>{fact(data,"origin")}{route}</loc>', (self.out/'sitemap.xml').read_text())

    def test_non_srl_omits_inapplicable_capital(self):
        data = fixture()
        data['facts']['legal_form']['value'] = 'PFA'
        data['facts']['share_capital']['value'] = ''
        build(data,self.out)
        self.assertNotIn('data-launch="share_capital"',(self.out/'prestator.html').read_text(encoding='utf-8'))

    def test_verified_markup_is_escaped(self):
        data = fixture()
        data['facts']['legal_name']['value'] = '<img src=x onerror=alert(1)>'
        build(data,self.out)
        text = (self.out/'prestator.html').read_text(encoding='utf-8')
        self.assertNotIn('<img src=x',text)
        self.assertIn('&lt;img src=x',text)

    def test_github_pages_prefix_preserves_ops_and_legal_links(self):
        data = json.loads(DEFAULT_LAUNCH.read_text(encoding='utf-8'))
        build(data,self.out,preview=True,base_path='/automation-services-website/')
        ops=(self.out/'fluxclar-ops.html').read_text(encoding='utf-8')
        self.assertIn('href="/automation-services-website/?pilot=ops#contact"',ops)
        for name in PUBLIC_PAGES:
            text=(self.out/name).read_text(encoding='utf-8')
            self.assertIn('href="/automation-services-website/"',text)
            self.assertNotIn('href="/"',text)
            self.assertIn('identitatea',text.lower())
            self.assertIn('respinse',text)

    def test_unsafe_preview_prefix_is_rejected(self):
        for prefix in ('//external.invalid/','/../','/x/../../','https://x.invalid/'):
            with self.assertRaises(ValueError):
                build(fixture(),self.out,preview=True,base_path=prefix)


if __name__ == '__main__':
    unittest.main(verbosity=2)
