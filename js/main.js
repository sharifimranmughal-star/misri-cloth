

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

// Always use the category banner configured in Admin → Categories.
// Product photos belong to product cards and must not override this banner.
function updateCatalogHero(category) {
  const hero = document.querySelector('#shop-hero');
  if (!hero) return;
  const inputs = Array.from(document.querySelectorAll('input[name="category"]'));
  const input = inputs.find(input => input.value === category) || inputs.find(input => input.value === 'all');
  if (!input?.dataset.heroImage) return;
  const source = input.dataset.heroImage;
  const position = input.dataset.heroPosition || 'center';
  const key = JSON.stringify([category, source, position]);
  if (hero.dataset.heroRequest === key) return;
  hero.dataset.heroRequest = key;
  hero.style.backgroundImage = `url(${JSON.stringify(source)})`;
  hero.style.backgroundPosition = position;
}

async function initShopPage() {
  const grid = document.querySelector("#shop-products");
  if (!grid) return;

  await loadCatalogConfiguration();
  let filters = { category: "all", sort: "featured", search: "" };
  const section = document.body.dataset.catalogSection;
  const categoryHost = document.querySelector('#catalog-category-options');
  function rebuildFilters() {
    const categories = MisriCatalog.categories[section] || [];
    if (!categories.some(category => category.id === filters.category)) filters.category = 'all';
    const all = { id: 'all', name: section === 'collections' ? 'All Fabrics' : 'All Stitching', image: section === 'collections' ? 'pics/11.png' : 'pics/22.png', position: 'center' };
    categoryHost.innerHTML = [all, ...categories].map(category => `<label><input type="radio" name="category" value="${escapeCatalogText(category.id)}" data-hero-image="${escapeCatalogText(category.image || all.image)}" data-hero-position="${escapeCatalogText(category.position || 'center')}" ${category.id === filters.category ? 'checked' : ''}><span>${escapeCatalogText(category.name)}</span></label>`).join('');
  }
  rebuildFilters();
  window.rebuildCatalogFilters = () => { rebuildFilters(); render(); };

  function render() {
    updateCatalogHero(filters.category);
    let items = getProductsByCategory(filters.category);

    // Apply search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      items = items.filter(product =>
        product.name.toLowerCase().includes(searchLower) ||
        String(product.description || "").toLowerCase().includes(searchLower) ||
        getProductCategoryLabel(product).toLowerCase().includes(searchLower)
      );
    }

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

    grid.innerHTML = items.length ? items.map(productCardHTML).join("") : '<div class="catalog-empty"><h3>No products in this selection yet</h3><p>Try another category or contact us for availability and custom orders.</p><a class="btn btn-outline" href="contact.html">Contact us</a></div>';
    const countEl = document.querySelector(".shop-count");
    if (countEl) countEl.textContent = `Showing ${items.length} products`;
  }

  categoryHost.addEventListener('change', event => {
    if (event.target.name !== 'category') return;
    filters.category = event.target.value;
    render();
  });

  window.renderCatalog = render;

  const sortSelect = document.querySelector("#sort-select");
  sortSelect?.addEventListener("change", () => {
    filters.sort = sortSelect.value;
    render();
  });

  const params = new URLSearchParams(window.location.search);
  const cat = params.get("category");
  const searchQuery = params.get("search");
  
  if (cat) {
    const input = Array.from(document.querySelectorAll('input[name="category"]')).find(input => input.value === cat);
    if (input) {
      input.checked = true;
      filters.category = cat;
    }
  }

  if (searchQuery) {
    filters.search = searchQuery;
    document.querySelectorAll('.catalog-switch a').forEach(link => {
      const url = new URL(link.href);
      url.searchParams.set('search', searchQuery);
      link.href = url.href;
    });
  }

  render();
}

function initProductPage() {
  const section = document.querySelector(".product-detail");
  if (!section) return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  if (!id) return;

  if (typeof productsApiLoadFinished !== "undefined" && (!productsApiLoadFinished || !tailoringSettingsLoadFinished)) {
    setTimeout(() => initProductPage(), 100);
    return;
  }

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
        '<div class="container product-not-found-msg" style="padding:80px 0;text-align:center"><h2>Product not found</h2><a href="collections.html" class="btn btn-primary" style="margin-top:20px">Back to Collections</a></div>'
      );
    }
    return;
  }

  section.querySelector(".product-not-found-msg")?.remove();

  if (section.dataset.rendered === String(id)) return;

  if (typeof loadMeasurementSchema === "function" && typeof measurementSchemaLoaded !== "undefined" && !measurementSchemaLoaded) {
    loadMeasurementSchema().then(() => initProductPage());
    return;
  }

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
      const index = Number(e.target.dataset.index);
      activateImage(index);
      const mappedColor = getColorForImageIndex(product, index);
      if (mappedColor) selectColor(mappedColor, false);
    });
  }

  function activateImage(index) {
    if (!mainImg || !product.images[index]) return;
    mainImg.src = product.images[index];
    thumbs?.querySelectorAll("img").forEach((img, i) => {
      img.classList.toggle("active", i === index);
    });
  }

  if (title) title.textContent = product.name;
  if (category) category.textContent = getProductCategoryLabel(product);
  if (rating) rating.innerHTML = `${renderStars(product.rating)} <span>${product.rating} (${product.reviews} reviews)</span>`;

  const isFabric = isFabricProduct(product);
  const allowedStitchingTypes = getProductStitchingTypes(product);
  const offersStitching = allowedStitchingTypes.length > 0;
  let qty = 1;

  const garmentOptions = isFabric ? null : MisriCatalog.garmentOptions(product);
  const availableSizes = isFabric
    ? (Array.isArray(product.sizes) ? product.sizes.filter(Boolean) : [])
    : [...garmentOptions.readyMadeSizes, ...(garmentOptions.customEnabled ? ["Custom Stitching"] : [])];
  let wantsStitching = !isFabric && MisriCatalog.isCustomSize(availableSizes[0]);
  let selectedTailoringType = (!isFabric ? garmentOptions.measurementType : null) || allowedStitchingTypes[0] || TAILORING_TYPES[0]?.id || "shalwar-kameez";

  const selectedAddonIds = new Set();
  function selectedAddons() {
    return wantsStitching && selectedTailoringType === 'shalwar-kameez'
      ? STITCHING_ADDONS.filter(a => selectedAddonIds.has(a.id)).map(({id, name, price}) => ({id, name, price})) : [];
  }
  function renderMeasurementPanel(typeId) {
    const panel = document.querySelector("#tailoring-measurements-wrap");
    if (!panel || typeof renderTailoringMeasurementsForm !== "function") return;
    selectedAddonIds.clear();
    panel.innerHTML = renderTailoringMeasurementsForm(typeId);
    if (typeId === 'shalwar-kameez' && STITCHING_ADDONS.length) {
      panel.insertAdjacentHTML('beforeend', `<fieldset class="stitching-extras"><legend>Optional stitching extras</legend><p>Choose any, several, or none. Prices are per garment.</p>${STITCHING_ADDONS.map(a => `<label class="stitching-extra"><input type="checkbox" data-addon-id="${escapeCatalogText(a.id)}"><span>${escapeCatalogText(a.name)}</span><strong>+${formatPrice(a.price)}</strong></label>`).join('')}</fieldset>`);
      panel.querySelectorAll('[data-addon-id]').forEach(input => input.addEventListener('change', () => {
        if (input.checked) selectedAddonIds.add(input.dataset.addonId); else selectedAddonIds.delete(input.dataset.addonId);
        updatePriceDisplay();
      }));
    }
    panel.hidden = !wantsStitching;
  }

  function getTailoringExtra() {
    return wantsStitching && isFabric ? getTailoringCharge(selectedTailoringType) : 0;
  }

  function updatePriceDisplay() {
    if (!price) return;
    if (isFabric) {
      const count = Math.max(1, qty);
      const fabricTotal = getFabricLineTotal(product) * count;
      const stitchingExtra = getTailoringExtra() * count;
      const extras = getStitchingAddonsTotal(selectedAddons()) * count;
      const grandTotal = fabricTotal + stitchingExtra + extras;
      price.innerHTML = `
        <span class="price-current">${formatPrice(getFabricLineTotal(product))}</span>
        <span class="fabric-total-label">Fabric ×${count}: <strong>${formatPrice(fabricTotal)}</strong></span>
        ${extras ? `<span class="fabric-tailoring-label">Optional extras: <strong>+${formatPrice(extras)}</strong></span>` : ""}
        ${stitchingExtra ? `<span class="fabric-tailoring-label">Stitching: <strong>+${formatPrice(stitchingExtra)}</strong></span>` : ""}
        <span class="fabric-grand-total">Total: <strong>${formatPrice(grandTotal)}</strong></span>
      `;
    } else if (selectedAddons().length) {
      const extras = getStitchingAddonsTotal(selectedAddons());
      price.innerHTML = `<span>${formatPrice(Number(product.price) + extras)}</span><span class="fabric-total-label">Garment: ${formatPrice(product.price)} + extras: ${formatPrice(extras)} per garment</span>`;
    } else if (product.originalPrice) {
      price.innerHTML = `<span class="price-old">${formatPrice(product.originalPrice)}</span><span>${formatPrice(product.price)}</span>`;
    } else {
      price.textContent = formatPrice(product.price);
    }
  }
  updatePriceDisplay();

  if (desc) desc.textContent = product.description;

  let selectedSize = availableSizes[0] || (isFabric ? "4 Meter" : undefined);
  let selectedColor = product.colors[0];

  function getMaxQtyForSelectedColor() {
    return getColorStock(product, selectedColor);
  }

  function updateQtyDisplay() {
    if (qtyEl) qtyEl.textContent = qty;
    updatePriceDisplay();
  }

  function updateStockAndQtyLimits() {
    const maxQty = getMaxQtyForSelectedColor();
    if (qty > maxQty) {
      qty = Math.max(1, maxQty);
      updateQtyDisplay();
    }
    updateProductDetailStock(id, selectedColor);
  }

  function selectColor(color, syncImage = true) {
    selectedColor = color;
    colors?.querySelectorAll(".color-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.color === color);
    });
    if (syncImage) {
      activateImage(getImageIndexForColor(product, color));
    }
    updateStockAndQtyLimits();
  }

  const sizeLabel = document.querySelector(".option-group label");
  if (sizeLabel) sizeLabel.textContent = isFabric ? "Length" : "Ready-made size or custom stitching";
  const sizeGroup = sizes?.closest(".option-group");
  if (isFabric && sizeGroup && !availableSizes.length) sizeGroup.hidden = true;
  if (!isFabric && garmentOptions.customEnabled) {
    const sizeGroup = sizes?.closest('.option-group');
    sizeGroup?.insertAdjacentHTML('afterend', '<div class="option-group garment-measurements" id="tailoring-measurements-wrap" hidden></div>');
    renderMeasurementPanel(selectedTailoringType);
  }

  if (sizes) {
    sizes.innerHTML = availableSizes.map((s, i) =>
      `<button type="button" class="size-btn ${i === 0 ? "active" : ""}" data-size="${s}">${s}</button>`
    ).join("");
    sizes.addEventListener("click", e => {
      if (!e.target.classList.contains("size-btn")) return;
      sizes.querySelectorAll(".size-btn").forEach(b => b.classList.remove("active"));
      e.target.classList.add("active");
      selectedSize = e.target.dataset.size;
      if (!isFabric) {
        wantsStitching = MisriCatalog.isCustomSize(selectedSize);
        const panel = document.querySelector('#tailoring-measurements-wrap');
        if (panel) panel.hidden = !wantsStitching;
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
      selectColor(e.target.dataset.color);
    });
  }

  if (isFabric && offersStitching) {
    const colorGroup = document.querySelector(".color-options")?.closest(".option-group");
    if (colorGroup && !document.querySelector("#tailoring-section")) {
      const tailoringHTML = `
        <div class="option-group tailoring-section" id="tailoring-section">
          <label>Custom Tailoring</label>
          <p class="tailoring-intro">Add expert stitching with this fabric, or buy fabric only.</p>
          <div class="tailoring-choice">
            <button type="button" class="tailoring-toggle-btn active" data-stitch="no">Fabric Only</button>
            <button type="button" class="tailoring-toggle-btn" data-stitch="yes">With Stitching</button>
          </div>
          <div class="tailoring-types" id="tailoring-types" hidden>
            <p class="tailoring-types-label">Select garment type:</p>
            <div class="tailoring-type-options"></div>
            <div id="tailoring-measurements-wrap" class="tailoring-measurements-wrap" hidden></div>
          </div>
        </div>
      `;
      colorGroup.insertAdjacentHTML("afterend", tailoringHTML);
      renderMeasurementPanel(selectedTailoringType);

      const typeContainer = document.querySelector(".tailoring-type-options");
      if (typeContainer) {
        typeContainer.innerHTML = allowedStitchingTypes.map((typeId, i) => {
          const type = TAILORING_TYPES.find((item) => item.id === typeId) || { id: typeId, label: typeId };
          const charge = getTailoringCharge(type.id);
          return `<button type="button" class="tailoring-type-btn ${i === 0 ? "active" : ""}" data-type="${type.id}">
            <span class="tailoring-type-name">${type.label}</span>
            <span class="tailoring-type-price">+${formatPrice(charge)}</span>
          </button>`;
        }).join("");
      }

      document.querySelectorAll(".tailoring-toggle-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          wantsStitching = btn.dataset.stitch === "yes";
          document.querySelectorAll(".tailoring-toggle-btn").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          const typesPanel = document.querySelector("#tailoring-types");
          if (typesPanel) typesPanel.hidden = !wantsStitching;
          const measureWrap = document.querySelector("#tailoring-measurements-wrap");
          if (measureWrap) measureWrap.hidden = !wantsStitching;
          updatePriceDisplay();
        });
      });

      document.querySelector(".tailoring-type-options")?.addEventListener("click", e => {
        const btn = e.target.closest(".tailoring-type-btn");
        if (!btn) return;
        selectedTailoringType = btn.dataset.type;
        document.querySelectorAll(".tailoring-type-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        renderMeasurementPanel(selectedTailoringType);
        updatePriceDisplay();
      });
    }
  }

  const qtyEl = document.querySelector("#qty-value");
  document.querySelector("#qty-decrease")?.addEventListener("click", () => {
    if (qty > 1) {
      qty--;
      updateQtyDisplay();
    }
  });
  document.querySelector("#qty-increase")?.addEventListener("click", () => {
    const maxQty = getMaxQtyForSelectedColor();
    if (qty < maxQty) {
      qty++;
      updateQtyDisplay();
    } else {
      showToast(`Only ${maxQty} available for ${selectedColor}`);
    }
  });

  document.querySelector("#add-to-cart-btn")?.addEventListener("click", () => {
    const currentProduct = getProductById(id);
    if (isOutOfStock(currentProduct, selectedColor)) {
      showToast(selectedColor ? `${selectedColor} is out of stock` : "This product is out of stock");
      return;
    }
    if (isFabric) {
      if (wantsStitching) {
        if (!offersStitching) {
          showToast("Custom stitching is not available for this fabric");
          return;
        }
        if (!selectedTailoringType || !allowedStitchingTypes.includes(selectedTailoringType)) {
          showToast("Please select a garment type for stitching");
          return;
        }
        const measurements = collectTailoringMeasurements();
        const validation = validateTailoringMeasurements(selectedTailoringType, measurements);
        if (!validation.valid) {
          showToast(validation.message);
          return;
        }
        addToCart(product.id, selectedSize, selectedColor, qty, {
          enabled: wantsStitching,
          type: selectedTailoringType,
          charge: getTailoringCharge(selectedTailoringType),
          addons: selectedAddons(),
          measurements
        });
        return;
      }
      addToCart(product.id, selectedSize, selectedColor, qty, {
        enabled: false,
        type: null,
        charge: 0,
        measurements: null
      });
    } else {
      if (wantsStitching) {
        const measurements = collectTailoringMeasurements();
        const validation = validateTailoringMeasurements(selectedTailoringType, measurements);
        if (!validation.valid) { showToast(validation.message); return; }
        addToCart(product.id, selectedSize, selectedColor, qty, {
          enabled: true, type: selectedTailoringType, charge: 0, measurements, addons: selectedAddons()
        });
      } else {
        addToCart(product.id, selectedSize, selectedColor, qty);
      }
    }
  });

  updateStockAndQtyLimits();

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

function initSearchModal() {
  const searchToggle = document.querySelector(".search-toggle");
  const searchModal = document.querySelector(".search-modal");
  const searchModalClose = document.querySelector(".search-modal-close");
  const searchInput = document.querySelector(".search-input");
  const searchSubmit = document.querySelector(".search-submit");
  const searchResults = document.querySelector(".search-results");

  if (!searchToggle || !searchModal) return;

  function openSearch() {
    searchModal.classList.add("open");
    setTimeout(() => searchInput?.focus(), 100);
    document.body.style.overflow = "hidden";
  }

  function closeSearch() {
    searchModal.classList.remove("open");
    document.body.style.overflow = "";
    if (searchInput) searchInput.value = "";
    if (searchResults) searchResults.innerHTML = "";
  }

  searchToggle.addEventListener("click", openSearch);
  searchModalClose?.addEventListener("click", closeSearch);

  searchModal.addEventListener("click", (e) => {
    if (e.target === searchModal) closeSearch();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && searchModal.classList.contains("open")) {
      closeSearch();
    }
  });

  function performSearch(query) {
    if (!query.trim()) {
      if (searchResults) searchResults.innerHTML = "";
      return;
    }

    const allProducts = getAllProducts();
    const filtered = allProducts.filter(product =>
      product.name.toLowerCase().includes(query.toLowerCase()) ||
      String(product.description || "").toLowerCase().includes(query.toLowerCase()) ||
      getProductCategoryLabel(product).toLowerCase().includes(query.toLowerCase())
    );

    if (searchResults) {
      if (filtered.length === 0) {
        searchResults.innerHTML = '<div class="no-results">No products found</div>';
      } else {
        searchResults.innerHTML = filtered.map(product => `
          <div class="search-result-item" data-product-id="${product.id}">
            <img src="${product.image}" alt="${product.name}" class="search-result-image">
            <div class="search-result-info">
              <div class="search-result-title">${product.name}</div>
              <div class="search-result-category">${getProductCategoryLabel(product)}</div>
              <div class="search-result-price">${formatPrice(product.price)}</div>
            </div>
          </div>
        `).join("");

        // Add click handlers to search results
        searchResults.querySelectorAll(".search-result-item").forEach(item => {
          item.addEventListener("click", () => {
            const productId = item.dataset.productId;
            closeSearch();
            window.location.href = `product.html?id=${productId}`;
          });
        });
      }
    }
  }

  let searchTimeout;
  searchInput?.addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => performSearch(e.target.value), 300);
  });

  searchSubmit?.addEventListener("click", () => {
    const query = searchInput?.value || "";
    if (query.trim()) {
      closeSearch();
      const match = PRODUCTS.find(product => [product.name, product.description, getProductCategoryLabel(product)].some(text => String(text || '').toLowerCase().includes(query.toLowerCase())));
      const destination = match ? (isFabricProduct(match) ? 'collections' : 'stitching') : (document.body.dataset.catalogSection || 'collections');
      window.location.href = `${destination}.html?search=${encodeURIComponent(query)}`;
    }
  });

  searchInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      searchSubmit?.click();
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadCatalogConfiguration().then(() => {
    updateCatalogNavigation();
    refreshProductDisplays();
  });
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
  initSearchModal();
});


// Keep existing category links accurate when names change or a category is removed.
function updateCatalogNavigation() {
  document.querySelectorAll('a[href*="stitching.html?category="], a[href*="collections.html?category="]').forEach(link => {
    const url = new URL(link.href, window.location.href);
    const section = url.pathname.endsWith('stitching.html') ? 'stitching' : 'collections';
    const category = MisriCatalog.categories[section].find(category => category.id === url.searchParams.get('category'));
    const heading = link.querySelector('h3');
    if (category) {
      if (heading) heading.textContent = category.name;
      else if (!link.children.length) link.textContent = category.name;
    } else {
      link.href = section + '.html';
      if (heading) heading.textContent = section === 'collections' ? 'Collections' : 'Stitching';
      else if (!link.children.length) link.textContent = section === 'collections' ? 'Collections' : 'Stitching';
    }
  });
}
