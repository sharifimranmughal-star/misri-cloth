let MEASUREMENT_SCHEMA = {};
let measurementSchemaLoaded = false;
let measurementSchemaPromise = null;

async function loadMeasurementSchema() {
  if (measurementSchemaLoaded) return MEASUREMENT_SCHEMA;
  if (measurementSchemaPromise) return measurementSchemaPromise;

  measurementSchemaPromise = fetch("/data/measurement-fields.json")
    .then((res) => (res.ok ? res.json() : {}))
    .then((data) => {
      MEASUREMENT_SCHEMA = data || {};
      measurementSchemaLoaded = true;
      return MEASUREMENT_SCHEMA;
    })
    .catch(() => {
      MEASUREMENT_SCHEMA = {};
      measurementSchemaLoaded = true;
      return MEASUREMENT_SCHEMA;
    });

  return measurementSchemaPromise;
}

function getMeasurementFields(typeId) {
  return MEASUREMENT_SCHEMA[typeId]?.fields || [];
}

function renderTailoringMeasurementsForm(typeId) {
  const fields = getMeasurementFields(typeId);
  if (!fields.length) {
    return `<p class="tailoring-measurements-empty">Measurement guide is loading. Please wait a moment.</p>`;
  }

  const inputs = fields.map((field) => {
    const inputId = `measure-${field.key}`;
    const requiredMark = field.required ? ' <span class="required-mark">*</span>' : "";
    if (field.type === "text") {
      return `
        <div class="measure-input-group measure-input-full">
          <label for="${inputId}">${field.label}${requiredMark}</label>
          <input type="text" id="${inputId}" name="${field.key}" data-measure-key="${field.key}" data-measure-type="text" ${field.required ? "required" : ""} placeholder="${field.hint || ""}">
        </div>`;
    }
    return `
      <div class="measure-input-group">
        <label for="${inputId}">${field.label}${requiredMark}</label>
        <div class="measure-input-wrap">
          <input type="number" id="${inputId}" name="${field.key}" data-measure-key="${field.key}" data-measure-type="number" min="1" step="0.25" inputmode="decimal" ${field.required ? "required" : ""} placeholder="0">
          ${field.unit ? `<span class="measure-unit">${field.unit}</span>` : ""}
        </div>
        ${field.hint ? `<small class="measure-hint">${field.hint}</small>` : ""}
      </div>`;
  }).join("");

  return `
    <div class="tailoring-measurements" id="tailoring-measurements">
      <p class="tailoring-measurements-label">Enter your measurements (in inches):</p>
      <div class="measure-input-grid">${inputs}</div>
      <p class="measurement-form-note"><i class="fas fa-ruler"></i> All marked fields are required for custom stitching.</p>
    </div>`;
}

function collectTailoringMeasurements(container) {
  const root = container || document.querySelector("#tailoring-measurements");
  if (!root) return {};

  const values = {};
  root.querySelectorAll("[data-measure-key]").forEach((input) => {
    const key = input.dataset.measureKey;
    const type = input.dataset.measureType || "number";
    const raw = input.value.trim();
    if (!raw) return;
    values[key] = type === "text" ? raw : Number(raw);
  });
  return values;
}

function validateTailoringMeasurements(typeId, measurements, container) {
  const fields = getMeasurementFields(typeId);
  const root = container || document.querySelector("#tailoring-measurements");
  if (!fields.length) return { valid: false, message: "Measurements could not be loaded. Please reload the page and try again." };

  for (const field of fields) {
    const value = measurements[field.key];
    if (field.required || (value !== undefined && value !== null && value !== "")) {
      if (value === undefined || value === null || value === "") {
        const input = root?.querySelector(`[data-measure-key="${field.key}"]`);
        input?.focus();
        return { valid: false, message: `Please enter ${field.label.toLowerCase()}` };
      }
      if (field.type !== "text") {
        const num = Number(value);
        if (!Number.isFinite(num) || num <= 0) {
          const input = root?.querySelector(`[data-measure-key="${field.key}"]`);
          input?.focus();
          return { valid: false, message: `${field.label} must be a valid measurement` };
        }
      }
    }
  }

  return { valid: true };
}

function clearTailoringMeasurementErrors(container) {
  const root = container || document.querySelector("#tailoring-measurements");
  root?.querySelectorAll(".measure-input-error").forEach((el) => el.classList.remove("measure-input-error"));
}

function formatMeasurementsSummary(typeId, measurements) {
  const fields = getMeasurementFields(typeId);
  const parts = [];
  for (const field of fields) {
    const value = measurements?.[field.key];
    if (value === undefined || value === null || value === "") continue;
    if (field.type === "text") {
      parts.push(`${field.label}: ${value}`);
    } else {
      parts.push(`${field.label}: ${value}${field.unit ? field.unit : ""}`);
    }
  }
  return parts.join(" · ");
}

if (typeof window !== "undefined") {
  loadMeasurementSchema();
}
