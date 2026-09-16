const MEASUREMENT_SCHEMA = require("../data/measurement-fields.json");
const { getTailoringLabel } = require("./tailoring-settings");

function getMeasurementSchema(typeId) {
  return MEASUREMENT_SCHEMA[typeId] || null;
}

function getMeasurementFields(typeId) {
  return getMeasurementSchema(typeId)?.fields || [];
}

function formatMeasurementValue(field, value) {
  if (value === null || value === undefined || value === "") return "";
  if (field.type === "text") return String(value).trim();
  const num = Number(value);
  if (!Number.isFinite(num)) return "";
  const unit = field.unit ? ` ${field.unit}` : "";
  return `${num}${unit}`;
}

function formatMeasurementsLines(typeId, measurements) {
  if (!measurements || typeof measurements !== "object") return [];
  const fields = getMeasurementFields(typeId);
  const lines = [];
  for (const field of fields) {
    const formatted = formatMeasurementValue(field, measurements[field.key]);
    if (formatted) lines.push(`${field.label}: ${formatted}`);
  }
  return lines;
}

function formatMeasurementsBlock(typeId, measurements) {
  const lines = formatMeasurementsLines(typeId, measurements);
  if (!lines.length) return "";
  const label = getTailoringLabel(typeId) || typeId;
  return `${label} measurements:\n${lines.map((line) => `  • ${line}`).join("\n")}`;
}

module.exports = {
  MEASUREMENT_SCHEMA,
  getMeasurementSchema,
  getMeasurementFields,
  formatMeasurementsLines,
  formatMeasurementsBlock
};
