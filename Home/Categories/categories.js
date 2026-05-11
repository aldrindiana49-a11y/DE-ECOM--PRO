let products = JSON.parse(localStorage.getItem("drinProducts")) || [];

let visibleCount = 12;
const loadMoreCount = 12;

const container = document.getElementById("categoryProductList");
const seeMoreBtn = document.getElementById("seeMoreBtn");

function formatPrice(price) {
  return "₱" + Number(price).toLocaleString();
}

function renderProducts() {
  const visibleProducts = products.slice(0, visibleCount);

  container.innerHTML = visibleProducts.map(p => `
    <div class="homepage-product-card" onclick="openProduct('${p.id}')">
      <div class="homepage-product-image">
        <img src="${p.image}" />
      </div>

      <div class="homepage-product-info">
        <h3>${p.name}</h3>
        <div class="homepage-product-pricing">
          <span class="current-price">${formatPrice(p.price)}</span>
        </div>
        <span class="homepage-product-stock">Stock: ${p.stock}</span>
      </div>
    </div>
  `).join("");

  if (visibleCount >= products.length) {
    seeMoreBtn.style.display = "none";
  }
}

function openProduct(id) {
  localStorage.setItem("selectedProductId", id);
  window.location.href = `/Home/Product/index.html?id=${encodeURIComponent(id)}`;
}

seeMoreBtn.addEventListener("click", () => {
  visibleCount += loadMoreCount;
  renderProducts();
});

renderProducts();