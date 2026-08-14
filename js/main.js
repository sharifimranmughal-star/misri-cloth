

function initThemeToggle() {
  const toggle = document.querySelector(".theme-toggle");
  if (!toggle) return;

  const savedTheme = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const initialTheme = savedTheme || (prefersDark ? "dark" : "light");

  document.documentElement.setAttribute("data-theme", initialTheme);
  updateThemeIcon(initialTheme);

  toggle.addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
    updateThemeIcon(newTheme);
  });

  function updateThemeIcon(theme) {
    const icon = toggle.querySelector("i");
    if (icon) {
      icon.className = theme === "dark" ? "fas fa-sun" : "fas fa-moon";
    }
  }
}

function initMobileNav() {
  const toggle = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".mobile-nav");
  const overlay = document.querySelector(".mobile-nav-overlay");
  const close = document.querySelector(".mobile-nav-close");

  if (!toggle) return;

  const open = () => {
    nav?.classList.add("open");
    overlay?.classList.add("open");
    document.body.style.overflow = "hidden";
  };

  const shut = () => {
    nav?.classList.remove("open");
    overlay?.classList.remove("open");
    document.body.style.overflow = "";
  };

  toggle.addEventListener("click", open);
  close?.addEventListener("click", shut);
  overlay?.addEventListener("click", shut);
}

function initScrollReveal() {
  const els = document.querySelectorAll(".reveal");
  if (!els.length) return;

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  els.forEach(el => observer.observe(el));
}

function initNewsletter() {
  document.querySelectorAll(".newsletter-form").forEach(form => {
    form.addEventListener("submit", e => {
      e.preventDefault();
      const input = form.querySelector("input");
      if (input?.value) {
        const emailResult = validateEmail(input.value, true);
        if (!emailResult.valid) {
          showToast(emailResult.message);
          return;
        }
        showToast("Thank you for subscribing!");
        input.value = "";
      }
    });
  });
}

function highlightActiveNav() {
  const page = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-desktop a, .mobile-nav a").forEach(link => {
    const href = link.getAttribute("href");
    if (href === page || (page === "" && href === "index.html")) {
      link.classList.add("active");
    }
  });
}

function initShopPage() {
  const grid = document.querySelector("#shop-products");
  if (!grid) return;

  let filters = { category: "all", sort: "featured" };

  function render() {
    let items = getProductsByCategory(filters.category);

    switch (filters.sort) {
      case "price-low":
        items = [...items].sort((a, b) => a.price - b.price);
        break;
      case "price-high":
        items = [...items].sort((a, b) => b.price - a.price);
        break;
      case "rating":
        items = [...items].sort((a, b) => b.rating - a.rating);
        break;
      case "new":
        items = items.filter(p => p.new);
        break;
      default:
        items = [...items].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
    }

    grid.innerHTML = items.map(productCardHTML).join("");
    const countEl = document.querySelector(".shop-count");
    if (countEl) countEl.textContent = `Showing ${items.length} products`;
  }

  document.querySelectorAll('input[name="category"]').forEach(input => {
    input.addEventListener("change", () => {
      filters.category = input.value;
      render();
    });
  });

  const sortSelect = document.querySelector("#sort-select");
  sortSelect?.addEventListener("change", () => {
    filters.sort = sortSelect.value;
    render();
  });

  const params = new URLSearchParams(window.location.search);
  const cat = params.get("category");
  if (cat) {
    const input = document.querySelector(`input[name="category"][value="${cat}"]`);
    if (input) {
      input.checked = true;
      filters.category = cat;
    }
  }

  render();
}

function initProductPage() {
  const section = document.querySelector(".product-detail");
  if (!section) return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  if (!id) return;

  let product = getProductById(id);

  // If product not found and API hasn't loaded yet, wait and retry
  if (!product && typeof productsLoadedFromApi !== "undefined" && !productsLoadedFromApi) {
    setTimeout(() => initProductPage(), 500);
    return;
  }

  if (!product) {
    if (!section.querySelector(".product-not-found-msg")) {
      section.insertAdjacentHTML(
        "afterbegin",
        '<div class="container product-not-found-msg" style="padding:80px 0;text-align:center"><h2>Product not found</h2><a href="shop.html" class="btn btn-primary" style="margin-top:20px">Back to Shop</a></div>'
      );
    }
    return;
  }

  section.querySelector(".product-not-found-msg")?.remove();

  if (section.dataset.rendered === String(id)) return;
  section.dataset.rendered = String(id);

  document.title = `${product.name} — MISRI CLOTH`;

  const mainImg = document.querySelector("#main-image");
  const thumbs = document.querySelector(".product-thumbs");
  const title = document.querySelector("#product-title");
  const category = document.querySelector("#product-category");
  const rating = document.querySelector("#product-rating");
  const price = document.querySelector("#product-price");
  const desc = document.querySelector("#product-desc");
  const sizes = document.querySelector(".size-options");
  const colors = document.querySelector(".color-options");

  if (mainImg) mainImg.src = product.images[0];
  if (mainImg) mainImg.alt = product.name;

  if (thumbs) {
    thumbs.innerHTML = product.images.map((img, i) =>
      `<img src="${img}" alt="${product.name}" class="${i === 0 ? "active" : ""}" data-index="${i}">`
    ).join("");

    thumbs.addEventListener("click", e => {
      if (e.target.tagName !== "IMG") return;
      mainImg.src = e.target.src;
      thumbs.querySelectorAll("img").forEach(img => img.classList.remove("active"));
      e.target.classList.add("active");
    });
  }

  if (title) title.textContent = product.name;
  if (category) category.textContent = getCategoryLabel(product.category);
  if (rating) rating.innerHTML = `${renderStars(product.rating)} <span>${product.rating} (${product.reviews} reviews)</span>`;

  const isFabric = isFabricProduct(product);
  let selectedMeters = isFabric ? parseMetersFromSize(product.sizes[0]) : 1;

  function updatePriceDisplay() {
    if (!price) return;
    if (isFabric) {
      const perMeter = getPerMeterPrice(product);
      const total = getFabricLineTotal(product, selectedMeters);
      price.innerHTML = `
        <span class="price-current">${formatPrice(perMeter)}/meter</span>
        <span class="fabric-total-label">Total (${selectedMeters}m): <strong>${formatPrice(total)}</strong></span>
      `;
    } else if (product.originalPrice) {
      price.innerHTML = `<span class="price-old">${formatPrice(product.originalPrice)}</span><span>${formatPrice(product.price)}</span>`;
    } else {
      price.textContent = formatPrice(product.price);
    }
  }
  updatePriceDisplay();

  if (desc) desc.textContent = product.description;

  let selectedSize = product.sizes[0];
  let selectedColor = product.colors[0];
  let qty = 1;

  const sizeLabel = document.querySelector(".option-group label");
  if (sizeLabel && isFabric) sizeLabel.textContent = "Meters (min. 4)";

  if (sizes) {
    sizes.innerHTML = product.sizes.map((s, i) =>
      `<button type="button" class="size-btn ${i === 0 ? "active" : ""}" data-size="${s}">${s}</button>`
    ).join("");
    sizes.addEventListener("click", e => {
      if (!e.target.classList.contains("size-btn")) return;
      sizes.querySelectorAll(".size-btn").forEach(b => b.classList.remove("active"));
      e.target.classList.add("active");
      selectedSize = e.target.dataset.size;
      if (isFabric) {
        selectedMeters = parseMetersFromSize(selectedSize);
        updatePriceDisplay();
      }
    });
  }

  if (colors) {
    colors.innerHTML = product.colors.map((c, i) =>
      `<button type="button" class="color-btn ${i === 0 ? "active" : ""}" data-color="${c}">${c}</button>`
    ).join("");
    colors.addEventListener("click", e => {
      if (!e.target.classList.contains("color-btn")) return;
      colors.querySelectorAll(".color-btn").forEach(b => b.classList.remove("active"));
      e.target.classList.add("active");
      selectedColor = e.target.dataset.color;
    });
  }

  const qtyRow = document.querySelector(".qty-selector")?.closest(".product-actions");
  if (qtyRow && isFabric) {
    qtyRow.querySelector(".qty-selector")?.style.setProperty("display", "none");
  }

  const qtyEl = document.querySelector("#qty-value");
  document.querySelector("#qty-decrease")?.addEventListener("click", () => {
    if (!isFabric && qty > 1) { qty--; if (qtyEl) qtyEl.textContent = qty; }
  });
  document.querySelector("#qty-increase")?.addEventListener("click", () => {
    if (!isFabric) { qty++; if (qtyEl) qtyEl.textContent = qty; }
  });

  document.querySelector("#add-to-cart-btn")?.addEventListener("click", () => {
    const currentProduct = getProductById(id);
    if (isOutOfStock(currentProduct)) {
      showToast("This product is out of stock");
      return;
    }
    if (isFabric) {
      addToCart(product.id, selectedSize, selectedColor, 1);
    } else {
      addToCart(product.id, selectedSize, selectedColor, qty);
    }
  });

  updateProductDetailStock(id);

  const related = document.querySelector("#related-products");
  if (related) {
    const relatedItems = PRODUCTS.filter(p => p.category === product.category && p.id !== product.id).slice(0, 4);
    related.innerHTML = relatedItems.map(productCardHTML).join("");
  }
}

function initHomePage() {
  const featured = document.querySelector("#featured-products");
  if (featured) {
    featured.innerHTML = getFeaturedProducts().map(productCardHTML).join("");
  }
}

function initMeasurementTabs() {
  const tabs = document.querySelectorAll(".measure-tab");
  const panels = document.querySelectorAll(".measurement-panel");
  if (!tabs.length) return;

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.panel;
      tabs.forEach(t => t.classList.remove("active"));
      panels.forEach(p => p.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(target)?.classList.add("active");
    });
  });

  const hash = window.location.hash.replace("#", "");
  if (hash === "measurements") {
    document.querySelector(".measurement-section")?.scrollIntoView({ behavior: "smooth" });
  }
}

function initWhatsApp() {
  if (document.querySelector(".whatsapp-float")) return;

  const link = document.createElement("a");
  link.href = "https://wa.me/923348711716?text=Hello%20MISRI%20CLOTH%2C%20I%20would%20like%20to%20inquire%20about...";
  link.className = "whatsapp-float";
  link.target = "_blank";
  link.rel = "noopener";
  link.setAttribute("aria-label", "Chat on WhatsApp");
  link.innerHTML = '<i class="fab fa-whatsapp"></i><span>WhatsApp</span>';
  document.body.appendChild(link);
}

async function initContactForm() {
  const form = document.querySelector(".contact-form");
  if (!form) return;

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const emailInput = form.email;
    const emailResult = validateEmail(emailInput.value.trim(), true);
    
    if (!emailResult.valid) {
      showFieldError(emailInput, emailResult.message);
      return;
    }
    
    clearFieldError(emailInput);
    
    const btn = form.querySelector('button[type="submit"]');
    const payload = {
      firstName: form.firstName.value.trim(),
      lastName: form.lastName.value.trim(),
      email: emailResult.email,
      subject: form.subject.value,
      message: form.message.value.trim()
    };

    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = "Sending...";

    try {
      const res = await fetch("/api/send_contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message);
        form.reset();
      } else {
        showToast(data.message || "Could not send message. Please WhatsApp us.");
      }
    } catch {
      showToast("Could not send. Please WhatsApp us at 0334-8711716");
    }

    btn.disabled = false;
    btn.textContent = originalText;
  });
  
  form.email?.addEventListener("input", () => clearFieldError(form.email));
}

document.addEventListener("DOMContentLoaded", () => {
  initThemeToggle();
  initMobileNav();
  initCartDrawer();
  initScrollReveal();
  initNewsletter();
  highlightActiveNav();
  initHomePage();
  initShopPage();
  initProductPage();
  initMeasurementTabs();
  initWhatsApp();
  initContactForm();
});

