const DEFAULT_TAILORING_CHARGES = {
  "shalwar-kameez": 2500,
  suits: 8000,
  "prince-coat": 6000,
  waistcoats: 3500
};

const TAILORING_TYPES = [
  { id: "shalwar-kameez", label: "Shalwar Qameez" },
  { id: "suits", label: "Suit" },
  { id: "prince-coat", label: "Prince Coat" },
  { id: "waistcoats", label: "Waistcoat" }
];

const ALL_TAILORING_TYPE_IDS = TAILORING_TYPES.map((type) => type.id);

function getTailoringLabel(typeId) {
  return TAILORING_TYPES.find((t) => t.id === typeId)?.label || typeId || "";
}

function normalizeTailoringCharges(raw) {
  const charges = { ...DEFAULT_TAILORING_CHARGES };
  if (raw && typeof raw === "object") {
    for (const type of TAILORING_TYPES) {
      const value = Number(raw[type.id]);
      if (Number.isFinite(value) && value >= 0) {
        charges[type.id] = value;
      }
    }
  }
  return charges;
}

function normalizeStitchingTypes(raw) {
  if (!Array.isArray(raw)) return [];
  const valid = new Set(ALL_TAILORING_TYPE_IDS);
  return [...new Set(raw.filter((id) => valid.has(id)))];
}

function applyProductStitching(product) {
  if (!product) return product;

  const isFabric = product.category === "fabric";
  const hasExplicitEnabled = typeof product.stitchingEnabled === "boolean";
  const hasExplicitTypes = Array.isArray(product.stitchingTypes);

  if (!isFabric) {
    product.stitchingEnabled = false;
    product.stitchingTypes = [];
    return product;
  }

  if (!hasExplicitEnabled && !hasExplicitTypes) {
    product.stitchingEnabled = true;
    product.stitchingTypes = [...ALL_TAILORING_TYPE_IDS];
    return product;
  }

  product.stitchingEnabled = hasExplicitEnabled ? product.stitchingEnabled : true;
  product.stitchingTypes = hasExplicitTypes
    ? normalizeStitchingTypes(product.stitchingTypes)
    : [...ALL_TAILORING_TYPE_IDS];

  if (!product.stitchingEnabled) {
    product.stitchingTypes = normalizeStitchingTypes(product.stitchingTypes);
  }

  return product;
}

function getAllowedStitchingTypes(product) {
  applyProductStitching(product);
  if (!product?.stitchingEnabled) return [];
  return product.stitchingTypes || [];
}

module.exports = {
  DEFAULT_TAILORING_CHARGES,
  TAILORING_TYPES,
  ALL_TAILORING_TYPE_IDS,
  getTailoringLabel,
  normalizeTailoringCharges,
  normalizeStitchingTypes,
  applyProductStitching,
  getAllowedStitchingTypes
};
