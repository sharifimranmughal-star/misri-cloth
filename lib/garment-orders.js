const { garmentOptions, isCustomSize } = require('../js/catalog');
const { getMeasurementFields } = require('./measurement-fields');

// Use the same order fields as fabric stitching so admin orders and notifications
// receive the garment's measurements without a second order format.
function validateGarmentOrderItem(product, item) {
  if (product.category === 'fabric') return { valid: true };
  const options = garmentOptions(product);
  const custom = Boolean(item.tailoring_enabled ?? item.tailoringEnabled);
  const submittedType = item.tailoring_type || item.tailoringType;
  const submittedMeasurements = item.tailoring_measurements || item.tailoringMeasurements;
  delete item.tailoringEnabled;
  delete item.tailoringType;
  delete item.tailoringMeasurements;
  delete item.tailoringCharge;
  if (custom !== isCustomSize(item.size)) {
    return { valid: false, message: 'Please choose a ready-made size or custom stitching again' };
  }
  if (!custom) {
    if (!options.readyMadeSizes.includes(item.size)) return { valid: false, message: 'This ready-made size is no longer available' };
    item.tailoring_enabled = false;
    item.tailoring_type = null;
    item.tailoring_charge = 0;
    item.tailoring_measurements = null;
    return { valid: true };
  }
  const type = submittedType;
  if (!options.customEnabled || type !== options.measurementType) {
    return { valid: false, message: 'Custom stitching options have changed. Please select this product again' };
  }
  const fields = getMeasurementFields(type);
  if (!fields.length) return { valid: false, message: 'Measurement form is unavailable for this garment' };
  const values = submittedMeasurements || {};
  const measurements = {};
  for (const field of fields) {
    const value = values[field.key];
    const empty = value == null || String(value).trim() === '';
    if (empty) {
      if (field.required) return { valid: false, message: `Please provide ${field.label.toLowerCase()} for ${product.name}` };
      continue;
    }
    if (field.type === 'text') measurements[field.key] = String(value).trim().slice(0, 1000);
    else {
      const number = Number(value);
      if (!Number.isFinite(number) || number <= 0) return { valid: false, message: `${field.label} must be a positive measurement` };
      measurements[field.key] = number;
    }
  }
  item.size = 'Custom Stitching';
  item.tailoring_enabled = true;
  item.tailoring_type = type;
  item.tailoring_charge = 0; // Garment stitching is included in the listed product price.
  item.tailoring_measurements = measurements;
  return { valid: true };
}
module.exports = { validateGarmentOrderItem };
