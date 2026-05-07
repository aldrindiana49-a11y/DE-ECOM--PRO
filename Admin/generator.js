/* ===============================
   AUTO LISTING GENERATOR - SAFE ADD ON
================================ */

const generateListingBtn = document.getElementById("generateListingBtn");
const keywordsInput = document.getElementById("keywordsInput");

const autoKeywordMap = {
  "Power Amplifier": "stereo, high power, bass, amplifier, audio, DIY",
  "Speaker & Tweeter": "speaker, tweeter, loud audio, bass, sound system",
  "Audio Processor": "equalizer, DSP, sound processor, audio tuning",
  "Transistor / MOSFET": "MOSFET, transistor, amplifier repair, electronics component",
  "Capacitor": "capacitor, electrolytic, filter capacitor, power supply",
  "Diode": "diode, rectifier, fast recovery, power supply repair",
  "Resistor": "resistor, ohms, precision, circuit repair",
  "Integrated Circuits (IC)": "IC, chip, audio IC, electronics repair",
  "PCB / Boards": "PCB, circuit board, DIY electronics, amplifier board",
  "Connectors & Terminals": "RCA, jack, connector, terminal, plug, socket",
  "Wires & Cables": "wire, cable, audio cable, speaker wire",
  "Others": "electronics, DIY, repair, high quality, tested"
};

function getAutoKeywords(category) {
  return autoKeywordMap[safeText(category)] || "electronics, DIY, repair, high quality, tested";
}

function cleanSkuPart(value, maxLength = 10) {
  return safeText(value)
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .join("-")
    .toUpperCase()
    .slice(0, maxLength) || "ITEM";
}

function getCategoryCode(category) {
  const codes = {
    "Power Amplifier": "AMP",
    "Speaker & Tweeter": "SPK",
    "Audio Processor": "AUD",
    "Transistor / MOSFET": "MOS",
    "Capacitor": "CAP",
    "Diode": "DIO",
    "Resistor": "RES",
    "Integrated Circuits (IC)": "IC",
    "PCB / Boards": "PCB",
    "Connectors & Terminals": "CON",
    "Wires & Cables": "WIR",
    "Others": "OTH"
  };

  return codes[safeText(category)] || cleanSkuPart(category, 4);
}

function generateAutoSku(category, name, suffix = "") {
  const nextNumber = String(products.length + 1).padStart(4, "0");
  const categoryCode = getCategoryCode(category);
  const nameCode = cleanSkuPart(name, 12);
  const suffixCode = suffix ? `-${cleanSkuPart(suffix, 6)}` : "";

  return `${categoryCode}-${nameCode}${suffixCode}-${nextNumber}`.slice(0, 40);
}

function buildAutoTitle(baseName, brand, category, keywords) {
  const cleanName = safeText(baseName, "Product");
  const cleanBrand = safeText(brand);
  const cleanCategory = safeText(category, "Electronics");

  let title = cleanBrand
    ? `${cleanBrand} ${cleanName} | ${cleanCategory} | ${keywords}`
    : `${cleanName} | ${cleanCategory} | ${keywords}`;

  title = title.replaceAll(",", " ");

  const extras = ["High Quality", "Tested", "Durable", "DIY Repair", "Best Price PH"];

  let i = 0;
  while (title.length < 90 && i < extras.length * 3) {
    title += ` ${extras[i % extras.length]}`;
    i++;
  }

  return title.slice(0, 100).trim();
}

function buildAutoDescription(baseName, brand, category, keywords) {
  const cleanName = safeText(baseName, "Product");
  const cleanBrand = safeText(brand, "Drin Electronics");
  const cleanCategory = safeText(category, "Electronics");

  return `🔥 ${cleanName}

Brand: ${cleanBrand}
Category: ${cleanCategory}

✔ Good quality electronics item
✔ Suitable for DIY, repair, replacement, and upgrade projects
✔ Carefully checked before packing when applicable
✔ Ideal for amplifier, audio, and electronics use

📦 Package Includes:
- 1x ${cleanName}

⚡ Search Keywords:
${safeText(keywords)}

💬 Message us for availability, compatibility, and bulk orders.`.slice(0, 500);
}

function fillVariantSkus(category, baseName) {
  const rows = Array.from(document.querySelectorAll("#variantTableBody tr[data-variant-id]"));

  rows.forEach((row, index) => {
    const labelInput = row.querySelector('[data-field="label"]');
    const skuInput = row.querySelector('[data-field="sku"]');
    const label = safeText(labelInput?.value, `Option ${index + 1}`);

    if (skuInput && !safeText(skuInput.value)) {
      skuInput.value = generateAutoSku(category, baseName, label);
    }
  });
}

function generateListingContent() {
  const baseName = safeText(nameInput?.value);
  const brand = safeText(brandInput?.value);
  const category = safeText(categoryInput?.value);

  if (!baseName) {
    showToast("Enter product title first.", "error");
    return;
  }

  if (!category) {
    showToast("Select category first.", "error");
    return;
  }

  let keywords = safeText(keywordsInput?.value);

  if (!keywords) {
    keywords = getAutoKeywords(category);
    if (keywordsInput) keywordsInput.value = keywords;
  }

  nameInput.value = buildAutoTitle(baseName, brand, category, keywords);
  descriptionInput.value = buildAutoDescription(baseName, brand, category, keywords);

  if (safeText(productTypeInput?.value, "single") === "single") {
    if (singleSkuInput && !safeText(singleSkuInput.value)) {
      singleSkuInput.value = generateAutoSku(category, baseName);
    }
  } else {
    fillVariantSkus(category, baseName);
  }

  showToast("Title, description, and SKU generated.", "success");
}

if (generateListingBtn) {
  generateListingBtn.addEventListener("click", generateListingContent);
}

window.generateListingContent = generateListingContent;
