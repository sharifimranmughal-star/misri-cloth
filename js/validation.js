const PHONE_COUNTRIES = [
  {
    code: "PK",
    name: "Pakistan",
    dial: "+92",
    digits: 10,
    placeholder: "334 8711716",
    hint: "10 digits starting with 3 (without leading 0)",
    pattern: /^3[0-9]{9}$/
  },
  {
    code: "AE",
    name: "United Arab Emirates",
    dial: "+971",
    digits: 9,
    placeholder: "50 123 4567",
    hint: "9 digits (mobile starts with 5)",
    pattern: /^5[0-9]{8}$/
  },
  {
    code: "SA",
    name: "Saudi Arabia",
    dial: "+966",
    digits: 9,
    placeholder: "5X XXX XXXX",
    hint: "9 digits starting with 5",
    pattern: /^5[0-9]{8}$/
  },
  {
    code: "GB",
    name: "United Kingdom",
    dial: "+44",
    digits: 10,
    placeholder: "7XXX XXXXXX",
    hint: "10 digits (mobile starts with 7)",
    pattern: /^7[0-9]{9}$/
  },
  {
    code: "US",
    name: "United States",
    dial: "+1",
    digits: 10,
    placeholder: "202 555 0123",
    hint: "10 digits",
    pattern: /^[2-9][0-9]{9}$/
  },
  {
    code: "IN",
    name: "India",
    dial: "+91",
    digits: 10,
    placeholder: "98XXX XXXXX",
    hint: "10 digits starting with 6–9",
    pattern: /^[6-9][0-9]{9}$/
  }
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function getPhoneCountry(code) {
  return PHONE_COUNTRIES.find((c) => c.code === code) || PHONE_COUNTRIES[0];
}

function phoneCountryOptions(selected = "PK") {
  return PHONE_COUNTRIES.map(
    (c) => `<option value="${c.code}" ${c.code === selected ? "selected" : ""}>${c.name} (${c.dial})</option>`
  ).join("");
}

function stripPhoneDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeNationalDigits(countryCode, rawPhone) {
  let digits = stripPhoneDigits(rawPhone);
  const country = getPhoneCountry(countryCode);

  if (countryCode === "PK") {
    if (digits.startsWith("92")) digits = digits.slice(2);
    if (digits.startsWith("0")) digits = digits.slice(1);
  } else if (countryCode === "AE" && digits.startsWith("971")) {
    digits = digits.slice(3);
  } else if (countryCode === "SA" && digits.startsWith("966")) {
    digits = digits.slice(3);
  } else if (countryCode === "GB" && digits.startsWith("44")) {
    digits = digits.slice(2);
  } else if (countryCode === "US" && digits.startsWith("1") && digits.length === 11) {
    digits = digits.slice(1);
  } else if (countryCode === "IN" && digits.startsWith("91")) {
    digits = digits.slice(2);
  }

  return { digits, country };
}

function validatePhone(countryCode, rawPhone) {
  const { digits, country } = normalizeNationalDigits(countryCode, rawPhone);

  if (!digits) {
    return { valid: false, message: "Phone number is required" };
  }
  if (digits.length !== country.digits) {
    return {
      valid: false,
      message: `${country.name} numbers must be ${country.digits} digits (${country.dial})`
    };
  }
  if (!country.pattern.test(digits)) {
    return { valid: false, message: `Invalid ${country.name} phone number. ${country.hint}` };
  }

  return {
    valid: true,
    e164: `${country.dial}${digits}`,
    national: digits,
    formatted: `${country.dial} ${digits}`
  };
}

function validateEmail(email, required = true) {
  const value = String(email || "").trim();
  if (!value) {
    return required
      ? { valid: false, message: "Email is required" }
      : { valid: true, email: "" };
  }
  if (!EMAIL_PATTERN.test(value)) {
    return { valid: false, message: "Please enter a valid email address." };
  }
  return { valid: true, email: value.toLowerCase() };
}

function showFieldError(input, message) {
  if (!input) return;
  input.classList.add("input-error");
  let err = input.parentElement?.querySelector(".field-error");
  if (!err) {
    err = document.createElement("span");
    err.className = "field-error";
    input.parentElement?.appendChild(err);
  }
  err.textContent = message;
}

function clearFieldError(input) {
  if (!input) return;
  input.classList.remove("input-error");
  input.parentElement?.querySelector(".field-error")?.remove();
}

function bindPhoneCountryField(countrySelect, phoneInput, hintEl) {
  function updateHint() {
    const country = getPhoneCountry(countrySelect.value);
    if (phoneInput) {
      phoneInput.placeholder = country.placeholder;
      phoneInput.maxLength = country.digits + 4;
    }
    if (hintEl) hintEl.textContent = country.hint;
  }
  countrySelect?.addEventListener("change", updateHint);
  updateHint();
}
