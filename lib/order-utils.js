const DELIVERY_CHARGE = 250;
const FREE_DELIVERY_MIN = 5000;

const PHONE_COUNTRIES = {
  PK: { dial: "+92", digits: 10, pattern: /^3[0-9]{9}$/, name: "Pakistan" },
  AE: { dial: "+971", digits: 9, pattern: /^5[0-9]{8}$/, name: "UAE" },
  SA: { dial: "+966", digits: 9, pattern: /^5[0-9]{8}$/, name: "Saudi Arabia" },
  GB: { dial: "+44", digits: 10, pattern: /^7[0-9]{9}$/, name: "United Kingdom" },
  US: { dial: "+1", digits: 10, pattern: /^[2-9][0-9]{9}$/, name: "United States" },
  IN: { dial: "+91", digits: 10, pattern: /^[6-9][0-9]{9}$/, name: "India" }
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function stripDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeNationalDigits(countryCode, rawPhone) {
  let digits = stripDigits(rawPhone);
  if (countryCode === "PK") {
    if (digits.startsWith("92")) digits = digits.slice(2);
    if (digits.startsWith("0")) digits = digits.slice(1);
  } else if (countryCode === "AE" && digits.startsWith("971")) digits = digits.slice(3);
  else if (countryCode === "SA" && digits.startsWith("966")) digits = digits.slice(3);
  else if (countryCode === "GB" && digits.startsWith("44")) digits = digits.slice(2);
  else if (countryCode === "US" && digits.startsWith("1") && digits.length === 11) digits = digits.slice(1);
  else if (countryCode === "IN" && digits.startsWith("91")) digits = digits.slice(2);
  return digits;
}

function validatePhoneServer(countryCode, rawPhone) {
  const country = PHONE_COUNTRIES[countryCode] || PHONE_COUNTRIES.PK;
  const digits = normalizeNationalDigits(countryCode, rawPhone);
  if (!digits || digits.length !== country.digits || !country.pattern.test(digits)) {
    return { valid: false, message: `Invalid ${country.name} phone number` };
  }
  return { valid: true, formatted: `${country.dial}${digits}` };
}

function validateEmailServer(email) {
  const value = String(email || "").trim();
  if (!value || !EMAIL_PATTERN.test(value)) {
    return { valid: false, message: "A valid email address is required" };
  }
  return { valid: true, email: value.toLowerCase() };
}

function calcDeliveryCharge(subtotal) {
  return Number(subtotal) >= FREE_DELIVERY_MIN ? 0 : DELIVERY_CHARGE;
}

function calcOrderTotal(subtotal) {
  return Number(subtotal) + calcDeliveryCharge(subtotal);
}

function hasTrackedStock(product) {
  return product.stockQuantity != null && product.stockQuantity !== undefined;
}

module.exports = {
  DELIVERY_CHARGE,
  FREE_DELIVERY_MIN,
  validatePhoneServer,
  validateEmailServer,
  calcDeliveryCharge,
  calcOrderTotal,
  hasTrackedStock
};
