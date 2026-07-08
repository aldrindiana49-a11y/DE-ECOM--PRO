/* ==========================================
   DRIN ELECTRONICS ACADEMY - RANDOM PRODUCTS
========================================== */

const recommendedProductList =
    document.getElementById("recommendedProductList");

const recommendedPagination =
    document.getElementById("recommendedPagination");

let recommendedPage = 1;
const recommendedPageSize = 10;
let availableRecommendedProducts = [];
let shuffledRecommendedProducts = [];

function safeNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function formatPrice(value) {
    return `₱${safeNumber(value, 0).toLocaleString()}`;
}

function getAcademyProducts() {
    return JSON.parse(localStorage.getItem("cachedProducts")) || [];
}

function getRandomProducts(products, limit = 10) {
    return [...products]
        .sort(() => Math.random() - 0.5)
        .slice(0, limit);
}

function renderRecommendedProducts() {
    if (!recommendedProductList) return;

    const products = getAcademyProducts();

    const availableProducts = products.filter(product => {

        const variants = Array.isArray(product.variants)
            ? product.variants
            : [];

        const stock = variants.length
            ? variants.reduce((sum, v) => sum + safeNumber(v.stock, 0), 0)
            : safeNumber(product.stock, 0);

        return stock > 0;

    });

    availableRecommendedProducts = availableProducts;

    if (!shuffledRecommendedProducts.length) {
        shuffledRecommendedProducts = getRandomProducts(
            availableRecommendedProducts,
            availableRecommendedProducts.length
        );
    }

    const start = (recommendedPage - 1) * recommendedPageSize;
    const end = start + recommendedPageSize;

    const randomProducts = shuffledRecommendedProducts.slice(start, end);

    recommendedProductList.innerHTML = "";

    if (!randomProducts.length) {
        recommendedProductList.innerHTML = `
      <div class="empty-products">
        No recommended products yet.
      </div>
    `;
        return;
    }

    randomProducts.forEach((product, index) => {
        const variants = Array.isArray(product.variants)
            ? product.variants
            : [];

        const firstVariant = variants[0] || {};

        const price =
            safeNumber(firstVariant.price, 0) ||
            safeNumber(product.price, 0);

        const discountPrice =
            safeNumber(firstVariant.discountPrice, 0) ||
            safeNumber(product.discountPrice, 0);

        const stock =
            variants.length
                ? variants.reduce((sum, v) => sum + safeNumber(v.stock, 0), 0)
                : safeNumber(product.stock, 0);

        const image =
            product.images?.[0] ||
            product.image ||
            firstVariant.image ||
            "https://via.placeholder.com/400x300?text=No+Image";

        const outOfStock = stock <= 0;

        const card = document.createElement("div");
        card.className =
            `homepage-product-card ${outOfStock ? "out-of-stock-card" : ""}`;

        card.onclick = () => {
            localStorage.setItem("selectedProduct", JSON.stringify(product));
            localStorage.setItem("selectedProductId", product.id || `product-${index}`);
            window.location.href =
                `../Product/index.html?id=${encodeURIComponent(product.id || "")}`;
        };


        card.innerHTML = `
      <div class="homepage-product-image">
        <img
          src="${image}"
          alt="${product.name || "Product"}"
          onerror="this.src='https://via.placeholder.com/400x300?text=No+Image'"
        />

        ${outOfStock ? `<div class="stock-overlay">Out of Stock</div>` : ""}
      </div>

      <div class="homepage-product-info">
        <span class="homepage-product-category">
          ${product.category || "Uncategorized"}
        </span>

        <h3>${product.name || "Unnamed Product"}</h3>

        <div class="homepage-rating">
          ★★★★☆ <span>${product.average_rating || "4.8"}</span>
        </div>

        ${discountPrice > 0 && discountPrice < price
                ? `
              <div class="homepage-product-pricing">
                <div class="current-price">${formatPrice(discountPrice)}</div>
                <div class="old-price">${formatPrice(price)}</div>
              </div>
            `
                : `
              <div class="homepage-product-pricing">
                <div class="current-price">${formatPrice(price)}</div>
              </div>
            `
            }

        <p class="homepage-product-stock ${outOfStock ? "out-stock-text" : ""}">
          ${outOfStock ? "Out of stock" : `Stock: ${stock}`}
        </p>
      </div>
    `;

        recommendedProductList.appendChild(card);
    });

    renderRecommendedPagination();
}

function renderRecommendedPagination() {
    if (!recommendedPagination) return;

    const totalPages = Math.ceil(
        shuffledRecommendedProducts.length / recommendedPageSize
    );

    let html = "";

    if (recommendedPage > 1) {
        html += `<button onclick="changeRecommendedPage(${recommendedPage - 1})">Prev</button>`;
    }

    for (let i = 1; i <= totalPages; i++) {
        html += `
            <button onclick="changeRecommendedPage(${i})" ${i === recommendedPage ? 'class="active"' : ""}>
                ${i}
            </button>
        `;
    }

    if (recommendedPage < totalPages) {
        html += `<button onclick="changeRecommendedPage(${recommendedPage + 1})">Next</button>`;
    }

    recommendedPagination.innerHTML = html;
}

function changeRecommendedPage(page) {
    const totalPages = Math.ceil(
        shuffledRecommendedProducts.length / recommendedPageSize
    );

    if (page < 1 || page > totalPages) return;

    recommendedPage = page;
    renderRecommendedProducts();
}

renderRecommendedProducts();