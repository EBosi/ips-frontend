const state = {
  rows: [],
  title: "",
  fileName: "",
  generatedIpsRows: [],
  generatedDetailedRows: [],
  uploadedUserRows: [],
  selectedAuthor: null,
};

const config = window.IPS_CONFIG || {};
const defaultBackendUrl = config.backendUrl || "http://127.0.0.1:8000";
const EXAMPLE_VALUES = {
  authorFirstName: "Emanuele",
  authorLastName: "Bosi",
  authorId: "50060939700",
  ssd: "BIO/18",
  startYear: "2022",
  endYear: "2026",
};

const ids = {
  authorFirstName: document.querySelector("#author-first-name"),
  authorLastName: document.querySelector("#author-last-name"),
  authorId: document.querySelector("#author-id"),
  researcherName: document.querySelector("#researcher-name"),
  ssd: document.querySelector("#ssd"),
  startYear: document.querySelector("#start-year"),
  endYear: document.querySelector("#end-year"),
  fillExample: document.querySelector("#fill-example"),
  searchAuthor: document.querySelector("#search-author"),
  loadIps: document.querySelector("#load-ips"),
  loadDetailed: document.querySelector("#load-detailed"),
  userCsv: document.querySelector("#user-csv"),
  compareUserTable: document.querySelector("#compare-user-table"),
  downloadCsv: document.querySelector("#download-csv"),
  status: document.querySelector("#status"),
  authorResults: document.querySelector("#author-results"),
  selectedAuthor: document.querySelector("#selected-author"),
  configMeta: document.querySelector("#config-meta"),
  resultsTitle: document.querySelector("#results-title"),
  resultsMeta: document.querySelector("#results-meta"),
  tableWrap: document.querySelector("#table-wrap"),
  helpPopover: document.querySelector("#help-popover"),
  infoButtons: [...document.querySelectorAll(".info-button")],
};

ids.configMeta.textContent = "Backend configurato e pronto.";
ids.startYear.value = "2022";
ids.endYear.value = "2026";

ids.fillExample.addEventListener("click", fillExampleValues);
ids.searchAuthor.addEventListener("click", searchAuthor);
ids.loadIps.addEventListener("click", () => loadTable("ips"));
ids.loadDetailed.addEventListener("click", () => loadTable("detailed"));
ids.userCsv.addEventListener("change", loadUserCsv);
ids.compareUserTable.addEventListener("click", compareUserTable);
ids.downloadCsv.addEventListener("click", downloadCsv);
ids.infoButtons.forEach((button) => {
  button.addEventListener("click", (event) => toggleHelp(event.currentTarget));
});
document.addEventListener("click", (event) => {
  if (event.target instanceof Element && !event.target.closest(".info-button") && !event.target.closest("#help-popover")) {
    hideHelp();
  }
});
renderSelectedAuthor();

function params() {
  const researcherName = ids.researcherName.value.trim() || [ids.authorFirstName.value.trim(), ids.authorLastName.value.trim()].filter(Boolean).join(" ").toUpperCase();
  const query = new URLSearchParams({
    author_id: ids.authorId.value.trim(),
    researcher_name: researcherName,
    ssd: ids.ssd.value.trim(),
    start_year: ids.startYear.value.trim(),
    end_year: ids.endYear.value.trim(),
  });
  return query;
}

async function loadTable(kind) {
  const validationError = validateGenerationFields();
  if (validationError) {
    setStatus(validationError, true);
    return;
  }

  setStatus("Caricamento in corso...");
  ids.downloadCsv.disabled = true;

  const base = defaultBackendUrl.replace(/\/$/, "");
  const endpoint = kind === "ips" ? "/api/scopus/ips-table" : "/api/scopus/detailed-table";
  const url = `${base}${endpoint}?${params().toString()}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    if (!Array.isArray(data)) {
      throw new Error("Il backend non ha restituito una lista.");
    }

    state.rows = data;
    if (kind === "ips") {
      state.generatedIpsRows = data;
    } else {
      state.generatedDetailedRows = data;
    }
    state.title = kind === "ips" ? "Tabella IPS" : "Tabella Dettagliata";
    state.fileName = kind === "ips" ? "ips_table_scopus.csv" : "detailed_table_scopus.csv";

    renderTable(data);
    ids.resultsTitle.textContent = state.title;
    ids.resultsMeta.textContent = `${data.length} righe`;
    ids.downloadCsv.disabled = data.length === 0;
    setStatus("Completato.");
  } catch (error) {
    console.error(error);
    setStatus(error.message, true);
    state.rows = [];
    ids.resultsMeta.textContent = "";
    ids.resultsTitle.textContent = "Errore";
    ids.tableWrap.className = "table-wrap empty";
    ids.tableWrap.innerHTML = "<p>Impossibile recuperare i dati.</p>";
  }
}

async function ensureComparisonData() {
  if (!state.generatedIpsRows.length) {
    state.generatedIpsRows = await fetchRows("/api/scopus/ips-table");
  }
  if (!state.generatedDetailedRows.length) {
    state.generatedDetailedRows = await fetchRows("/api/scopus/detailed-table");
  }
}

async function fetchRows(endpoint) {
  const base = defaultBackendUrl.replace(/\/$/, "");
  const url = `${base}${endpoint}?${params().toString()}`;
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  if (!Array.isArray(data)) {
    throw new Error("Il backend non ha restituito una lista.");
  }
  return data;
}

async function searchAuthor() {
  const firstName = ids.authorFirstName.value.trim();
  const lastName = ids.authorLastName.value.trim();
  if (!firstName || !lastName) {
    setStatus("Inserisci nome e cognome per cercare l'autore.", true);
    return;
  }

  setStatus("Ricerca autore in corso...");
  state.selectedAuthor = null;
  ids.authorId.value = "";
  ids.researcherName.value = "";
  renderSelectedAuthor();
  const base = defaultBackendUrl.replace(/\/$/, "");
  const query = new URLSearchParams({
    query: `authlast(${lastName}) and authfirst(${firstName})`,
    count: "10",
  });
  const url = `${base}/api/scopus/author-search?${query.toString()}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    if (!Array.isArray(data)) {
      throw new Error("Il backend non ha restituito una lista di autori.");
    }
    renderAuthorResults(data);
    setStatus(data.length ? `Trovati ${data.length} profili. Seleziona quello corretto.` : "Nessun profilo trovato.");
  } catch (error) {
    console.error(error);
    ids.authorResults.className = "author-results empty";
    ids.authorResults.innerHTML = "<p>Ricerca autore fallita.</p>";
    setStatus("Ricerca autore non riuscita. Controlla nome e cognome o riprova tra poco.", true);
  }
}

async function compareUserTable() {
  if (!state.uploadedUserRows.length) {
    setStatus("Carica prima un CSV utente.", true);
    return;
  }

  setStatus("Confronto in corso...");
  ids.downloadCsv.disabled = true;

  try {
    await ensureComparisonData();
    const report = buildComparisonReport(state.uploadedUserRows, state.generatedIpsRows, state.generatedDetailedRows);
    state.rows = report;
    state.title = "Report Inconsistenze";
    state.fileName = "comparison_report_scopus.csv";
    renderTable(report);
    ids.resultsTitle.textContent = state.title;
    ids.resultsMeta.textContent = `${report.length} righe`;
    ids.downloadCsv.disabled = report.length === 0;
    setStatus("Confronto completato.");
  } catch (error) {
    console.error(error);
    setStatus(error.message, true);
  }
}

function loadUserCsv(event) {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const rows = parseCsv(String(reader.result || ""));
      state.uploadedUserRows = rows;
      setStatus(`CSV utente caricato: ${rows.length} righe.`);
    } catch (error) {
      console.error(error);
      setStatus("Parsing CSV fallito.", true);
    }
  };
  reader.readAsText(file, "utf-8");
}

function renderTable(rows) {
  if (!rows.length) {
    ids.tableWrap.className = "table-wrap empty";
    ids.tableWrap.innerHTML = "<p>Nessun risultato.</p>";
    return;
  }

  const columns = Object.keys(rows[0]);
  const thead = `<thead><tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead>`;
  const tbody = rows
    .map(
      (row) =>
        `<tr>${columns
          .map((column) => `<td>${escapeHtml(row[column] == null ? "" : String(row[column]))}</td>`)
          .join("")}</tr>`
    )
    .join("");

  ids.tableWrap.className = "table-wrap";
  ids.tableWrap.innerHTML = `<table>${thead}<tbody>${tbody}</tbody></table>`;
}

function downloadCsv() {
  if (!state.rows.length) {
    return;
  }

  const columns = Object.keys(state.rows[0]);
  const lines = [
    columns.map(csvCell).join(","),
    ...state.rows.map((row) => columns.map((column) => csvCell(row[column])).join(",")),
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = state.fileName;
  anchor.click();
  URL.revokeObjectURL(href);
}

function renderAuthorResults(rows) {
  if (!rows.length) {
    ids.authorResults.className = "author-results empty";
    ids.authorResults.innerHTML = "<p>Nessun autore trovato.</p>";
    return;
  }

  ids.authorResults.className = "author-results";
  ids.authorResults.innerHTML = rows
    .map((row) => {
      const subjects = (row.subject_areas || []).slice(0, 3).join(" | ");
      return `
        <article class="author-card${state.selectedAuthor && state.selectedAuthor.authorId === row.author_id ? " selected" : ""}">
          <strong>${escapeHtml(row.preferred_name || row.author_id)}</strong>
          <div class="author-meta">
            ID: ${escapeHtml(row.author_id || "")} ·
            ORCID: ${escapeHtml(row.orcid || "n/d")} ·
            Documenti: ${escapeHtml(row.document_count || "n/d")}
          </div>
          <div class="author-meta">
            ${escapeHtml(row.affiliation_name || "Affiliazione non disponibile")}
            ${row.affiliation_country ? ` · ${escapeHtml(row.affiliation_country)}` : ""}
          </div>
          <div class="author-meta">${escapeHtml(subjects)}</div>
          <button type="button" data-author-id="${escapeHtml(row.author_id || "")}" data-name="${escapeHtml(row.preferred_name || "")}">
            Usa Questo Autore
          </button>
        </article>
      `;
    })
    .join("");

  ids.authorResults.querySelectorAll("button[data-author-id]").forEach((button) => {
    button.addEventListener("click", () => {
      ids.authorId.value = button.dataset.authorId || "";
      if (button.dataset.name) {
        ids.researcherName.value = button.dataset.name.toUpperCase();
      }
      state.selectedAuthor = {
        authorId: button.dataset.authorId || "",
        researcherName: (button.dataset.name || "").toUpperCase(),
      };
      renderSelectedAuthor();
      renderAuthorResults(rows);
      setStatus(`Autore selezionato: ${button.dataset.name || button.dataset.authorId}`);
    });
  });
}

function fillExampleValues() {
  ids.authorFirstName.value = EXAMPLE_VALUES.authorFirstName;
  ids.authorLastName.value = EXAMPLE_VALUES.authorLastName;
  ids.authorId.value = EXAMPLE_VALUES.authorId;
  ids.researcherName.value = `${EXAMPLE_VALUES.authorFirstName} ${EXAMPLE_VALUES.authorLastName}`.toUpperCase();
  ids.ssd.value = EXAMPLE_VALUES.ssd;
  ids.startYear.value = EXAMPLE_VALUES.startYear;
  ids.endYear.value = EXAMPLE_VALUES.endYear;
  state.selectedAuthor = {
    authorId: EXAMPLE_VALUES.authorId,
    researcherName: `${EXAMPLE_VALUES.authorFirstName} ${EXAMPLE_VALUES.authorLastName}`.toUpperCase(),
  };
  renderSelectedAuthor();
  setStatus("Esempio caricato. Puoi modificarlo liberamente.");
}

function validateGenerationFields() {
  if (!ids.authorId.value.trim()) {
    return "Cerca prima l'autore e seleziona il profilo corretto.";
  }
  if (!ids.startYear.value.trim() || !ids.endYear.value.trim()) {
    return "Compila anno iniziale e anno finale.";
  }
  return "";
}

function renderSelectedAuthor() {
  if (!state.selectedAuthor || !state.selectedAuthor.authorId) {
    ids.selectedAuthor.className = "selected-author empty";
    ids.selectedAuthor.innerHTML = "<p>Nessun autore selezionato. Cerca nome e cognome, poi scegli il profilo corretto dai risultati.</p>";
    return;
  }

  ids.selectedAuthor.className = "selected-author";
  ids.selectedAuthor.innerHTML = `
    <strong>Autore selezionato</strong>
    <div>${escapeHtml(state.selectedAuthor.researcherName || "Profilo Scopus")}</div>
    <div class="author-meta">Scopus Author ID: ${escapeHtml(state.selectedAuthor.authorId)}</div>
  `;
}

function toggleHelp(button) {
  const helpText = button.dataset.help || "";
  if (!helpText) {
    hideHelp();
    return;
  }

  const rect = button.getBoundingClientRect();
  ids.helpPopover.textContent = helpText;
  ids.helpPopover.hidden = false;
  ids.helpPopover.style.top = `${rect.bottom + window.scrollY + 8}px`;
  ids.helpPopover.style.left = `${Math.max(16, rect.left + window.scrollX - 120)}px`;
}

function hideHelp() {
  ids.helpPopover.hidden = true;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(value);
      if (row.some((cell) => cell !== "")) {
        rows.push(row);
      }
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  if (value !== "" || row.length) {
    row.push(value);
    rows.push(row);
  }

  if (!rows.length) {
    return [];
  }

  const headers = rows[0];
  return rows.slice(1).map((cells) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = cells[index] ?? "";
    });
    return record;
  });
}

function buildComparisonReport(userRows, generatedIpsRows, generatedDetailedRows) {
  const report = [];
  const generatedByDoi = new Map();
  const generatedByTitle = new Map();

  generatedIpsRows.forEach((row) => {
    const citation = row["IRIS Articoli su rivista - Periodo 2022-2026"] || "";
    const doi = extractDoi(citation);
    const titleKey = normalizeTitle(extractTitle(citation));
    if (doi) {
      generatedByDoi.set(doi, row);
    }
    if (titleKey) {
      generatedByTitle.set(titleKey, row);
    }
  });

  const detailedByCitationKey = new Map();
  generatedDetailedRows.forEach((row) => {
    const doi = extractDoi(row.citation || "");
    const titleKey = normalizeTitle(row.title || extractTitle(row.citation || ""));
    const key = doi || titleKey;
    if (!key) {
      return;
    }
    if (!detailedByCitationKey.has(key)) {
      detailedByCitationKey.set(key, []);
    }
    detailedByCitationKey.get(key).push(row);
  });

  const matchedKeys = new Set();

  userRows.forEach((userRow) => {
    const citation = userRow["IRIS Articoli su rivista - Periodo 2022-2026"] || "";
    const reportedQuartile = userRow["QUARTILE utilizzando wos o scopus o Scimago"] || "";
    const doi = extractDoi(citation);
    const titleKey = normalizeTitle(extractTitle(citation));
    const generatedRow = (doi && generatedByDoi.get(doi)) || generatedByTitle.get(titleKey);
    const matchKey = doi || titleKey;

    if (!generatedRow) {
      report.push({
        status: "reported_not_found",
        user_doi: doi,
        user_title: extractTitle(citation),
        user_quartile: reportedQuartile,
        found_quartiles: "",
        notes: "Articolo presente nella tabella utente ma non trovato in Scopus.",
      });
      return;
    }

    matchedKeys.add(matchKey);
    const detailedRows = detailedByCitationKey.get(matchKey) || [];
    const foundQuartiles = [...new Set(detailedRows.map((row) => row.quartile).filter(Boolean))].sort().join("|");
    const bestQuartile = generatedRow["QUARTILE utilizzando wos o scopus o Scimago"] || "";

    if (reportedQuartile && bestQuartile && reportedQuartile !== bestQuartile) {
      report.push({
        status: "quartile_mismatch",
        user_doi: doi,
        user_title: extractTitle(citation),
        user_quartile: reportedQuartile,
        found_quartiles: foundQuartiles || bestQuartile,
        notes: "Il quartile riportato non coincide con il miglior quartile Scopus disponibile.",
      });
    }
  });

  generatedIpsRows.forEach((generatedRow) => {
    const citation = generatedRow["IRIS Articoli su rivista - Periodo 2022-2026"] || "";
    const doi = extractDoi(citation);
    const titleKey = normalizeTitle(extractTitle(citation));
    const matchKey = doi || titleKey;
    if (matchedKeys.has(matchKey)) {
      return;
    }
    report.push({
      status: "found_not_reported",
      user_doi: doi,
      user_title: extractTitle(citation),
      user_quartile: "",
      found_quartiles: generatedRow["QUARTILE utilizzando wos o scopus o Scimago"] || "",
      notes: "Articolo trovato in Scopus ma assente nella tabella utente.",
    });
  });

  return report;
}

function extractDoi(text) {
  const match = String(text || "").match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);
  return match ? match[0].toLowerCase() : "";
}

function extractTitle(citation) {
  const text = String(citation || "");
  const yearMatch = text.match(/\(\d{4}\)\.\s*/);
  if (!yearMatch || yearMatch.index == null) {
    return text;
  }
  const afterYear = text.slice(yearMatch.index + yearMatch[0].length);
  const periodIndex = afterYear.indexOf(". ");
  if (periodIndex === -1) {
    return afterYear;
  }
  return afterYear.slice(0, periodIndex);
}

function normalizeTitle(text) {
  return String(text || "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, " ")
    .trim();
}

function csvCell(value) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setStatus(message, isError = false) {
  ids.status.textContent = message;
  ids.status.classList.toggle("error", isError);
}
