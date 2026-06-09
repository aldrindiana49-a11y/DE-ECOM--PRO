(function () {
    const section = document.getElementById("trendingProductsSection");
    if (!section) return;

    function safeNumber(value) {
        const num = Number(value);
        return Number.isFinite(num) ? num : 0;
    }

    function escapeHtml(text) {
        return String(text ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function formatPrice(value) {
        return `₱${safeNumber(value).toLocaleString()}`;
    }

    function getPrice(product) {
        if (Array.isArray(product.variants) && product.variants.length) {
            const v = product.variants[0];
            return v.discountPrice || v.price || 0;
        }

        return product.discountPrice || product.price || 0;
    }

    function getImage(product) {
        if (product.image) return product.image;
        if (Array.isArray(product.images) && product.images.length) return product.images[0];
        if (Array.isArray(product.variants) && product.variants[0]?.image) return product.variants[0].image;

        return "https://via.placeholder.com/400x400?text=No+Image";
    }

    function getTrendingProducts(productList = []) {
        const stats = JSON.parse(localStorage.getItem("drinTrendingStats")) || {};

        const scored = productList.map((product, index) => {
            const id = product.id;
            const s = stats[id] || {};

            const views = safeNumber(product.views || s.views);
            const addToCart = safeNumber(product.addToCart || s.addToCart);
            const sold = safeNumber(product.sold || s.sold);

            return {
                ...product,
                trendingViews: views,
                trendingAddToCart: addToCart,
                trendingSold: sold,
                trendingScore: views + addToCart * 3 + sold * 5,
                fallbackOrder: index
            };
        });

        const hasTrendingData = scored.some((p) => p.trendingScore > 0);

        if (hasTrendingData) {
            return scored
                .sort((a, b) => b.trendingScore - a.trendingScore)
                .slice(0, 10);
        }

        return scored.slice(0, 10);
    }

    function renderTrendingProducts(productList = []) {
        const products = getTrendingProducts(productList);

        if (!products.length) {
            section.innerHTML = "";
            return;
        }

        section.innerHTML = `
      <div class="trending-products-wrap">
        <div class="trending-products-header">
          <div>
            <h2>🔥 Trending Products</h2>
            <p>Madalas tinitingnan at ina-add to cart</p>
          </div>
        </div>

        <div class="trending-products-row">
          ${products.map((product, index) => `
            <div class="trending-product-card" data-id="${escapeHtml(product.id)}">
              <div class="trending-rank">#${index + 1}</div>

              <div class="trending-image">
                <img
                  src="${escapeHtml(getImage(product))}"
                  alt="${escapeHtml(product.name)}"
                  onerror="this.src='https://via.placeholder.com/400x400?text=No+Image'"
                >
              </div>

              <div class="trending-info">
                <span class="trending-category">${escapeHtml(product.category || "Product")}</span>
                <h3>${escapeHtml(product.name || "Unnamed Product")}</h3>
                <div class="trending-price">${formatPrice(getPrice(product))}</div>
                <div class="trending-meta">
                  👀 ${product.trendingViews || 0} · 🛒 ${product.trendingAddToCart || 0}
                </div>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;

        section.querySelectorAll(".trending-product-card").forEach((card) => {
            card.addEventListener("click", () => {
                const id = card.dataset.id;
                const product = products.find((p) => String(p.id) === String(id));
                if (!product) return;

                localStorage.setItem("selectedProduct", JSON.stringify(product));
                localStorage.setItem("selectedProductId", product.id);

                window.location.href = `./Product/index.html?id=${encodeURIComponent(product.id)}`;
            });
        });
    }

    window.renderTrendingProducts = renderTrendingProducts;
})();