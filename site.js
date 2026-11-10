"use strict";
document.documentElement.classList.add("js");

// Curated examples: this demonstration does not call an AI service.
const scenarios = {
  invoice: {
    slug: "factura",
    question: "Cum trimit o factură spre aprobare?",
    intro: "Conform procedurii demonstrative de achiziții:",
    steps: ["Adaugă factura în folderul „Facturi de aprobat”.", "Completează furnizorul, suma și centrul de cost.", "Trimite cererea responsabilului de buget."],
    note: "După verificare, responsabilul actualizează statusul cererii.",
    source: "Procedura de achiziții · § 2",
    excerpt: "§ 2 — Solicitantul adaugă factura în folderul «Facturi de aprobat», completează furnizorul, suma și centrul de cost, apoi trimite cererea responsabilului de buget. Responsabilul verifică documentul și actualizează statusul cererii."
  },
  remote: {
    slug: "lucru-la-distanta",
    question: "Cum solicit o zi de lucru de la distanță?",
    intro: "În ghidul fictiv al echipei sunt descriși acești pași:",
    steps: ["Discută ziua dorită cu managerul echipei.", "Înregistrează solicitarea în calendarul comun.", "Actualizează locul de lucru după confirmare."],
    note: "Acesta este un exemplu de procedură, nu politica unei companii reale.",
    source: "Ghidul echipei · § 4",
    excerpt: "§ 4 — Pentru o zi de lucru de la distanță, colegul discută ziua dorită cu managerul, înregistrează solicitarea în calendarul comun și actualizează locul de lucru după confirmare."
  },
  unknown: {
    slug: "fara-sursa",
    question: "Care este bugetul echipei pentru anul viitor?",
    intro: "Nu am găsit această informație în documentele demonstrative disponibile.",
    steps: [],
    note: "Nu pot confirma o sumă fără o sursă. Verifică informația cu persoana responsabilă de buget. Într-un proiect, stabilim împreună ce face agentul în astfel de situații.",
    source: "", excerpt: ""
  }
};
const sourceToggle = document.querySelector("#source-toggle");
const sourceExcerpt = document.querySelector("#source-excerpt");
const scenarioButtons = document.querySelectorAll("[data-scenario]");
const demoStatus = document.querySelector("#demo-status");
const answerState = document.querySelector("#answer-state");
const answerStateLabel = document.querySelector("#answer-state-label");

function initialScenario() {
  const linked = new URLSearchParams(location.search).get("scenariu");
  const keys = Object.keys(scenarios);
  const linkedKey = keys.find((key) => scenarios[key].slug === linked);
  if (linkedKey) return linkedKey;
  return "invoice";
}

function showScenario(key, announce = false) {
  const scenario = scenarios[key];
  if (!scenario) return;
  scenarioButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.scenario === key)));
  document.querySelector("#scenario-question").textContent = scenario.question;
  document.querySelector("#answer-intro").textContent = scenario.intro;
  const list = document.querySelector("#answer-steps");
  list.replaceChildren(...scenario.steps.map((step) => {
    const item = document.createElement("li");
    item.textContent = step;
    return item;
  }));
  list.hidden = scenario.steps.length === 0;
  document.querySelector("#answer-note").textContent = scenario.note;
  document.querySelector("#source-label").textContent = scenario.source;
  document.querySelector("#source-text").textContent = scenario.excerpt;
  sourceToggle.hidden = !scenario.source;
  sourceToggle.setAttribute("aria-expanded", "false");
  sourceExcerpt.hidden = true;
  answerState.dataset.missing = String(!scenario.source);
  answerStateLabel.textContent = scenario.source ? "Răspuns cu sursă" : "Sursă indisponibilă";
  if (announce) demoStatus.textContent = scenario.question + " " + answerStateLabel.textContent + ".";
}

scenarioButtons.forEach((button) => {
  button.disabled = false;
  button.addEventListener("click", () => {
    const key = button.dataset.scenario;
    if (button.getAttribute("aria-pressed") !== "true") showScenario(key, true);
    if (location.protocol === "http:" || location.protocol === "https:") {
      const url = new URL(location.href);
      url.searchParams.set("scenariu", scenarios[key].slug);
      url.hash = "demo";
      history.replaceState(history.state, "", url);
    }
  });
});
sourceToggle.addEventListener("click", () => {
  sourceExcerpt.hidden = !sourceExcerpt.hidden;
  sourceToggle.setAttribute("aria-expanded", String(!sourceExcerpt.hidden));
});
showScenario(initialScenario());
window.addEventListener("popstate", () => {
  const key = initialScenario();
  const active = document.querySelector('[data-scenario][aria-pressed="true"]');
  if (active?.dataset.scenario !== key) showScenario(key);
});

const menuToggle = document.querySelector(".menu-toggle");
menuToggle.hidden = false;
const navigation = document.querySelector("#main-nav");
function closeMenu() {
  menuToggle.setAttribute("aria-expanded", "false");
  navigation.classList.remove("is-open");
}
menuToggle.addEventListener("click", () => {
  const expanded = menuToggle.getAttribute("aria-expanded") !== "true";
  menuToggle.setAttribute("aria-expanded", String(expanded));
  navigation.classList.toggle("is-open", expanded);
});
navigation.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && menuToggle.getAttribute("aria-expanded") === "true") {
    closeMenu();
    menuToggle.focus();
  }
});

const form = document.querySelector("#inquiry");
const service = document.querySelector("#service");
const message = document.querySelector("#message");
const messageHint = document.querySelector("#message-hint");
const defaultMessageHint = messageHint.textContent;
const messageError = document.querySelector("#message-error");
const personName = document.querySelector("#name");
const replyEmail = document.querySelector("#reply-email");
const replyEmailError = document.querySelector("#reply-email-error");
const submitButton = document.querySelector("#inquiry-button");
const submitLabel = document.querySelector("#inquiry-label");
const status = document.querySelector("#form-status");
const draft = document.querySelector("#copy-draft");
const draftPanel = document.querySelector("#draft-panel");
const mailDraft = document.querySelector("#mail-draft");
const directEmail = document.querySelector("#direct-email");
const email = String(window.AUTOMATION_CONTACT_EMAIL || "").trim();
const canSubmit = window.AUTOMATION_INQUIRY_ENDPOINT === "/api/inquiries"
  && window.FLUXCLAR_LOCAL_API === true
  && ["127.0.0.1", "localhost"].includes(location.hostname)
  && location.protocol === "http:"
  && typeof window.crypto?.randomUUID === "function";
const replyAddressPattern = /^[^@\s<>]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;
let sending = false;
let lastSubmission;

const opsOption = service.querySelector('[data-pilot="ops"]');
if (new URLSearchParams(location.search).get("pilot") === "ops") {
  opsOption.defaultSelected = true;
  service.value = opsOption.value;
  if (!message.value) message.value = "Aș dori să discut un pilot FluxClar Ops.";
}

if (canSubmit) {
  document.querySelector("#reply-email-field").hidden = false;
  replyEmail.disabled = false;
  replyEmail.required = true;
  document.querySelector("#draft-privacy").hidden = true;
  document.querySelector("#inquiry-privacy").hidden = false;
  submitLabel.textContent = "Trimite cererea";
  document.querySelector("#inquiry-privacy").textContent = "Test local: cererea și adresa de răspuns se salvează în SQLite pe acest calculator. Folosește numai date sintetice. Acest API nu face parte din release-ul public.";
  document.querySelector("#email-fallback").hidden = false;
}
const hasEmail = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?)+$/i.test(email);
if (hasEmail) {
  directEmail.href = "mailto:" + email;
  directEmail.textContent = email;
} else {
  directEmail.hidden = true;
  mailDraft.hidden = true;
}

function clearDraft() {
  draftPanel.hidden = true;
  draft.value = "";
}
function resetStatus() {
  if (canSubmit) {
    status.textContent = "Trimite cererea aici. Îți vom răspunde la adresa indicată.";
  } else {
    status.textContent = hasEmail
      ? "Pregătești o ciornă. Pentru trimitere, apasă „Trimite” în aplicația ta de e-mail."
      : "Poți pregăti și copia mesajul. Adresa de contact nu este încă disponibilă.";
  }
}
function updateMessageHint() {
  messageHint.textContent = service.value === opsOption.value
    ? "Adaugă câte magazine ai, dacă folosiți Teams și cum ajung azi problemele la suport."
    : defaultMessageHint;
}
function showFieldError(field, hint) {
  field.setAttribute("aria-invalid", "true");
  hint.hidden = false;
  field.focus();
}
function clearFieldError(field, hint) {
  field.removeAttribute("aria-invalid");
  hint.hidden = true;
}

async function submitInquiry() {
  const fields = {
    name: personName.value.trim(),
    email: replyEmail.value.trim(),
    service: service.selectedOptions[0].dataset.code,
    message: message.value.trim()
  };
  const signature = JSON.stringify(fields);
  if (lastSubmission?.signature !== signature) {
    lastSubmission = { signature, id: window.crypto.randomUUID() };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  const controls = [personName, replyEmail, service, message, submitButton];
  sending = true;
  form.setAttribute("aria-busy", "true");
  document.querySelector("#email-fallback").disabled = true;
  controls.forEach((control) => { control.disabled = true; });
  submitLabel.textContent = "Se trimite…";
  status.textContent = "Se trimite cererea.";

  try {
    const response = await fetch("/api/inquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...fields, request_id: lastSubmission.id }),
      signal: controller.signal
    });
    if (!response.ok || (await response.json()).received !== true) throw new Error("Unconfirmed inquiry");
    form.reset();
    clearDraft();
    updateMessageHint();
    lastSubmission = undefined;
    status.textContent = "Cererea a fost primită. Îți vom răspunde la adresa de e-mail indicată.";
    window.dispatchEvent(new Event("fluxclar:inquiry-received"));
  } catch {
    status.textContent = "Nu am putut confirma primirea. Datele au rămas în formular. Reîncearcă aceeași cerere sau folosește „Pregătește e-mailul ca alternativă”. Dacă mesajul a fost deja salvat, e-mailul poate dubla cererea.";
  } finally {
    clearTimeout(timeout);
    sending = false;
    form.removeAttribute("aria-busy");
    document.querySelector("#email-fallback").disabled = false;
    controls.forEach((control) => { control.disabled = false; });
    submitLabel.textContent = "Trimite cererea";
  }
}

document.querySelectorAll("[data-service]").forEach((link) => link.addEventListener("click", () => {
  if (sending) return;
  service.value = link.dataset.service;
  updateMessageHint();
  clearDraft();
  resetStatus();
}));
form.addEventListener("input", (event) => {
  if (event.target === service) updateMessageHint();
  if (event.target === message && message.value.trim()) clearFieldError(message, messageError);
  if (event.target === replyEmail && replyEmail.validity.valid && replyAddressPattern.test(replyEmail.value.trim())) {
    clearFieldError(replyEmail, replyEmailError);
  }
  clearDraft();
  resetStatus();
});
form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (sending) return;
  if (canSubmit && (!replyEmail.validity.valid || !replyAddressPattern.test(replyEmail.value.trim()))) {
    showFieldError(replyEmail, replyEmailError);
    return;
  }
  if (!message.value.trim() || message.value.length > 1800) {
    showFieldError(message, messageError);
    return;
  }
  if (canSubmit) {
    void submitInquiry();
    return;
  }
  prepareEmail();
});

function prepareEmail() {
  if (!message.value.trim() || message.value.length > 1800) {
    showFieldError(message, messageError);
    return;
  }
  const subject = "Cerere de ofertă B2B · " + service.value;
  const introduction = personName.value.trim() ? "Sunt " + personName.value.trim() + ". " : "";
  const body = "Bună ziua!\n\n" + introduction + "Mă interesează: " + service.value + ".\n\n" + message.value.trim() + "\n\nMulțumesc!";
  draft.value = body;
  draftPanel.hidden = false;
  if (hasEmail) {
    const mailto = "mailto:" + email + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
    mailDraft.href = mailto;
    status.textContent = "Ciorna este pregătită pentru " + email + ". Nu a fost trimisă. Deschide aplicația de e-mail și apasă „Trimite”, sau copiază textul de mai jos.";
    mailDraft.focus();
  } else {
    status.textContent = "Mesajul este pregătit pentru copiere. Nu a fost trimis.";
  }
}
document.querySelector("#email-fallback").addEventListener("click", prepareEmail);
document.querySelector("#copy-button").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(draft.value);
    status.textContent = "Mesaj copiat. " + (hasEmail ? "Trimite-l la " + email + "." : "Îl poți păstra până când datele de contact sunt disponibile.") + " Site-ul nu l-a trimis automat.";
  } catch {
    draft.focus();
    draft.select();
    status.textContent = "Selectează și copiază mesajul cu Ctrl+C, ⌘C sau meniul de copiere al telefonului. Nu a fost trimis.";
  }
});

// Prevent native GET submission (and query-string disclosure) when JS is unavailable.
form.noValidate = true;
updateMessageHint();
resetStatus();
submitButton.disabled = false;
