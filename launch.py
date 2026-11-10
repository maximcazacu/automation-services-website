"""Launch input validation and escaped, static publication of verified facts only."""
import re
from html import escape
from urllib.parse import urlsplit

LABELS = {
    "origin": "Domeniul HTTPS", "legal_name": "Denumirea legală", "legal_form": "Forma juridică",
    "registered_office": "Sediul", "trade_register": "Numărul registrului comerțului", "cui": "CUI",
    "share_capital": "Capitalul social (obligatoriu pentru SRL)", "phone": "Telefonul", "email": "E-mailul",
    "controller": "Operatorul GDPR", "controller_contact": "Contactul operatorului pentru drepturi",
    "dpo": "DPO sau motivul pentru care nu este aplicabil",
    "inquiry_basis": "Scopurile, temeiurile cererilor și interesele legitime, dacă se aplică",
    "logs_basis": "Datele din jurnale, scopul, temeiul și interesul legitim",
    "inquiry_retention": "Retenția cererilor și momentul de început",
    "logs_retention": "Retenția jurnalelor", "backup_retention": "Retenția copiilor de siguranță",
    "deletion_process": "Procedura de ștergere, inclusiv copii de siguranță",
    "automated_decisions": "Decizii automatizate și profilare",
    "requests_mode": "Modul de primire a cererilor", "inbox_owner": "Responsabilul pentru cereri",
    "inbox_delivery_test": "Dovada verificării primirii și răspunsului prin e-mail",
    "regulated_activity": "Autoritate/profesie reglementată sau neaplicabilitate",
}
OPTIONAL = {"share_capital"}
EMAIL = re.compile(r"[^@\s<>]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+")
PLACEHOLDER = re.compile(r"de confirmat|de completat|placeholder|TODO|TBD|exemplu", re.I)


def fact(data, key):
    record = data.get("facts", {}).get(key, {})
    value = record.get("value", "")
    if (isinstance(value, str) and value.strip() and record.get("verified") is True
            and isinstance(record.get("evidence"), str) and record["evidence"].strip()
            and not PLACEHOLDER.search(value)):
        return value.strip()
    return ""


def origin_url(value):
    parsed = urlsplit(value)
    host = parsed.hostname or ""
    if (parsed.scheme != "https" or parsed.netloc != host or parsed.path not in ("", "/")
            or parsed.query or parsed.fragment or "." not in host
            or host.endswith((".test", ".invalid", ".localhost", ".example"))
            or host in {"example.com", "example.org", "example.net", "localhost"}
            or not re.fullmatch(r"[a-z0-9.-]+", host) or re.fullmatch(r"[\d.]+", host)):
        raise ValueError("origin: este necesar domeniul HTTPS real, fără cale, port sau credențiale")
    return "https://" + host


def approved_providers(data):
    providers = data.get("providers", [])
    keys = ("name", "service", "role", "data", "location", "transfers", "safeguards", "evidence")
    return [p for p in providers if isinstance(p, dict) and p.get("verified") is True
            and all(isinstance(p.get(k), str) and p[k].strip() and not PLACEHOLDER.search(p[k]) for k in keys)]


def problems(data):
    errors = [f"{key}: {label} — lipsește valoarea verificată și dovada"
              for key, label in LABELS.items() if key not in OPTIONAL and not fact(data, key)]
    legal_form = re.sub(r"[^A-Z]", "", fact(data, "legal_form").upper())
    if legal_form and legal_form not in {"SRL", "SRLD", "PFA", "II", "IF", "SA", "SNC", "SCS", "SCA"}:
        errors.append("legal_form: folosește abrevierea formei juridice (SRL, SRL-D, PFA, II, IF, SA, SNC, SCS sau SCA)")
    if "SRL" in legal_form and not fact(data, "share_capital"):
        errors.append("share_capital: capitalul social verificat este obligatoriu pentru SRL")
    origin = fact(data, "origin")
    if origin:
        try:
            origin_url(origin)
        except ValueError as exc:
            errors.append(str(exc))
    if fact(data, "email") and not EMAIL.fullmatch(fact(data, "email")):
        errors.append("email: adresa nu este validă")
    if fact(data, "phone") and not re.fullmatch(r"\+?[\d ()-]{7,30}", fact(data, "phone")):
        errors.append("phone: numărul nu este valid")
    providers = approved_providers(data)
    if len(providers) != len(data.get("providers", [])) or not {"hosting", "email"}.issubset({p["service"] for p in providers}):
        errors.append("providers: confirmă hosting și email; nume, rol, date, locație, transferuri, garanții și dovezi")
    if fact(data, "requests_mode") not in ("", "email"):
        errors.append("requests_mode: acest release acceptă numai email; API public necesită implementare și review separat")
    if data.get("public_api", {}).get("authorized") is not False or data.get("public_api", {}).get("endpoint") != "":
        errors.append("public_api: endpointul public rămâne dezactivat în acest release")
    if data.get("optional_features") != {"ga4": False, "external_booking": False, "demo_storage": False}:
        errors.append("optional_features: GA4, rezervările și stocarea demo trebuie să fie false")
    approval = data.get("approval", {})
    if not all(isinstance(approval.get(k), str) and approval[k].strip() for k in ("by", "date", "evidence")):
        errors.append("approval: lipsesc responsabilul, data și dovada aprobării fișei")
    return errors


def footer(data):
    identity = fact(data, "legal_name") or "Preview · Datele prestatorului sunt în curs de confirmare"
    email = fact(data, "email")
    contact = f'<a href="mailto:{escape(email, quote=True)}">{escape(email)}</a>' if email else '<a href="index.html#contact">Contact</a>'
    return f'''<footer class="footer wrap">
    <a class="brand" href="index.html" aria-label="FluxClar — acasă"><img src="fluxclar-on-light.svg" alt="" width="230" height="64" loading="lazy"></a>
    <p>{escape(identity)}<br>Servicii pentru companii și profesioniști · Ofertă la cerere</p>
    <nav class="footer-policies" aria-label="Informații FluxClar">
      <a href="prestator.html">Datele prestatorului</a>
      <a href="privacy.html">Confidențialitate</a>
      <a href="cookies.html">Cookie-uri și stocare</a>
      {contact}
    </nav>
  </footer>'''


def render(document, data, preview):
    legal_form = re.sub(r"[^A-Z]", "", fact(data, "legal_form").upper())
    if legal_form and "SRL" not in legal_form and not fact(data, "share_capital"):
        document = re.sub(r'<div><dt>Capitalul social.*?</div>', '', document, flags=re.S)
    def slot(match):
        key = match[1]
        value = fact(data, key) or "De confirmat: " + LABELS[key]
        return f'<span data-launch="{key}">{escape(value)}</span>'
    document = re.sub(r'<span data-launch="([a-z_]+)">.*?</span>', slot, document, flags=re.S)
    providers = approved_providers(data)
    content = "<p>Furnizorii, rolurile, accesul și transferurile nu sunt încă aprobate. Acest preview nu este pregătit pentru utilizare comercială.</p>"
    if providers:
        content = "".join(f'<p><strong>{escape(p["name"])}</strong> — {escape(p["service"])}. Rol: {escape(p["role"])}. Date: {escape(p["data"])}. Locație și acces: {escape(p["location"])}. Transferuri: {escape(p["transfers"])}. Garanții și acces la o copie: {escape(p["safeguards"])}.</p>' for p in providers)
    document = re.sub(r'<!-- providers:start -->.*?<!-- providers:end -->', lambda _: '<!-- providers:start -->' + content + '<!-- providers:end -->', document, flags=re.S)
    document = re.sub(r'<footer class="footer wrap">.*?</footer>', lambda _: footer(data), document, flags=re.S)
    notice = '<p class="preview-notice" role="note">Preview pentru review și redesign. Identitatea vizuală și numele actual sunt respinse și urmează să fie înlocuite. Site-ul nu este lansat comercial. Nu trimite date reale pentru testare.</p>' if preview else ""
    document = re.sub(r'<!-- preview:start -->.*?<!-- preview:end -->', '<!-- preview:start -->' + notice + '<!-- preview:end -->', document, flags=re.S)
    email = fact(data, "email")
    if email:
        document = document.replace("maximcazacu0501@mail.com", escape(email, quote=True))
    return document
