
const SUPABASE_URL =
    "https://zdinvxowzpkolbfzpcac.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_yWOmkaQzsh7sInJPhDOFWw_tyjALAuP";

const SITE_URL =
    "https://drinelectronicsph.com";

const LOGO_URL =
    "https://zdinvxowzpkolbfzpcac.supabase.co/storage/v1/object/public/product-images/logo.png";

const FALLBACK_IMAGE =
    `${SITE_URL}/Image/social-preview.png`;



/* =====================================
   HELPERS
===================================== */

function escapeHtml(value = "") {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function escapeXml(value = "") {
    return escapeHtml(value);
}

function safeNumber(value, fallback = 0) {
    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : fallback;
}

function formatPrice(value) {
    return `PHP ${safeNumber(value).toLocaleString("en-PH")}`;
}

function getFirstVariation(product) {
    if (
        Array.isArray(product?.variations) &&
        product.variations.length
    ) {
        return product.variations[0];
    }

    if (
        Array.isArray(product?.variants) &&
        product.variants.length
    ) {
        return product.variants[0];
    }

    return {};
}

function getPricing(product) {
    const variation =
        getFirstVariation(product);

    const regularPrice =
        safeNumber(
            variation.price ||
            product.price
        );

    const discountPrice =
        safeNumber(
            variation.discountPrice ||
            variation.discount_price ||
            product.discount_price ||
            product.discountPrice
        );

    const hasDiscount =
        discountPrice > 0 &&
        regularPrice > 0 &&
        discountPrice < regularPrice;

    const finalPrice =
        hasDiscount
            ? discountPrice
            : regularPrice;

    const discountPercent =
        hasDiscount
            ? Math.round(
                ((regularPrice - discountPrice) /
                    regularPrice) *
                100
            )
            : 0;

    return {
        regularPrice,
        finalPrice,
        discountPercent,
        hasDiscount
    };
}

function getProductImage(product) {
    const variation =
        getFirstVariation(product);

    return (
        variation.image ||
        product.image ||
        product.image_url ||
        product.thumbnail ||
        product.main_image ||
        product.gallery?.[0] ||
        FALLBACK_IMAGE
    );
}

function wrapTitle(text, maxChars = 28) {
    const cleanTitle =
        String(text || "").trim();

    if (cleanTitle.length <= maxChars) {
        return [cleanTitle];
    }

    return [
        `${cleanTitle.slice(0, maxChars - 3).trim()}...`
    ];
}

async function fetchBuffer(url) {
    const response =
        await fetch(url);

    if (!response.ok) {
        throw new Error(
            `Unable to load image: ${response.status}`
        );
    }

    return Buffer.from(
        await response.arrayBuffer()
    );
}

/* =====================================
   SUPABASE PRODUCT
===================================== */

async function getProduct(id) {
    const productUrl =
        `${SUPABASE_URL}/rest/v1/products` +
        `?id=eq.${encodeURIComponent(id)}` +
        `&select=*`;

    const response =
        await fetch(productUrl, {
            headers: {
                apikey: SUPABASE_KEY,
                Authorization:
                    `Bearer ${SUPABASE_KEY}`
            }
        });

    if (!response.ok) {
        throw new Error(
            `Supabase error: ${response.status}`
        );
    }

    const products =
        await response.json();

    return products?.[0] || null;
}

/* =====================================
   PREMIUM CARD IMAGE
===================================== */

async function generatePremiumCard(product) {
    const title =
        product.title ||
        product.name ||
        "Drin Electronics Product";

    const titleLines =
        wrapTitle(title, 38);

    const {
        regularPrice,
        finalPrice,
        hasDiscount
    } = getPricing(product);

    const productImageUrl =
        getProductImage(product);

    let productImageBuffer;
    let logoBuffer;

    try {
        productImageBuffer =
            await fetchBuffer(productImageUrl);
    } catch {
        productImageBuffer =
            await fetchBuffer(FALLBACK_IMAGE);
    }

    try {
        logoBuffer =
            await fetchBuffer(LOGO_URL);
    } catch {
        logoBuffer = null;
    }

    const resizedProductImage =
        await sharp(productImageBuffer)
            .resize(560, 420, {
                fit: "contain",
                withoutEnlargement: true,
                kernel: sharp.kernel.lanczos3,
                background: {
                    r: 255,
                    g: 255,
                    b: 255,
                    alpha: 1
                }
            })
            .sharpen()
            .png()
            .toBuffer();

    let resizedLogo = null;

    if (logoBuffer) {
        resizedLogo =
            await sharp(logoBuffer)
                .resize(150, 58, {
                    fit: "contain",
                    background: {
                        r: 255,
                        g: 255,
                        b: 255,
                        alpha: 0
                    }
                })
                .png()
                .toBuffer();
    }

    const titleSvg =
        titleLines
            .map(
                (line, index) => `
          <text
            x="620"
            y="${120 + index * 42}"
           font-family="Arial"
            font-size="28"
            font-weight="700"
            fill="#222222"
          >
            ${escapeXml(line)}
          </text>
        `
            )
            .join("");

    const oldPriceSvg =
        hasDiscount
            ? `
        <text
          x="620"
          y="215"
         font-family="Arial"
          font-size="22"
          font-weight="700"
          fill="#8a8a8a"
          text-decoration="line-through"
        >
          ${escapeXml(formatPrice(regularPrice))}
        </text>
      `
            : "";

    const footerTitle =
        String(title || "").length > 52
            ? `${String(title).slice(0, 49).trim()}...`
            : String(title);

    const overlaySvg = `
    <svg
      width="1200"
      height="630"
      viewBox="0 0 1200 630"
      xmlns="http://www.w3.org/2000/svg"
    >
      
            <rect
        x="8"
        y="8"
        width="1184"
        height="614"
        rx="18"
        fill="#ffffff"
        stroke="#d9d9d9"
        stroke-width="2"
      />

      <!-- left image area -->
      <rect
        x="24"
        y="24"
        width="560"
        height="420"
        fill="#ffffff"
      />

      <!-- right details area -->
      <rect
        x="600"
        y="24"
        width="576"
        height="420"
        fill="#ffffff"
      />

      ${titleSvg}

      ${oldPriceSvg}

      <text
        x="620"
        y="270"
       font-family="Arial"
        font-size="42"
        font-weight="700"
        fill="#f15a24"
      >
        ${escapeXml(formatPrice(finalPrice))}
      </text>

      <text
        x="620"
        y="325"
        font-family="Arial"
        font-size="22"
        font-weight="700"
        fill="#ff6b00"
      >
        5.0 Rating
      </text>

      <rect
        x="980"
        y="360"
        width="150"
        height="54"
        fill="#f15a24"
        rx="4"
      />

      <text
        x="1055"
        y="394"
        text-anchor="middle"
        font-family="Arial"
        font-size="20"
        font-weight="700"
        fill="#ffffff"
      >
        DRIN
      </text>

      <!-- bottom strip -->
      <rect
        x="8"
        y="458"
        width="1184"
        height="46"
        fill="#1aa7c9"
      />

      <text
        x="26"
        y="487"
        font-family="Arial"
        font-size="15"
        font-weight="700"
        fill="#ffffff"
      >
        DRINELECTRONICSPH.COM
      </text>

      <!-- bottom content -->
      <text
        x="24"
        y="548"
       font-family="Arial"
        font-size="20"
        font-weight="400"
        fill="#7a7a7a"
      >
        DRINELECTRONICSPH.COM
      </text>

      <text
        x="24"
        y="590"
        font-family="Arial"
        font-size="20"
        font-weight="700"
        fill="#222222"
      >
        ${escapeXml(footerTitle)}
      </text>
    </svg>
  `;

    const compositeImages = [
        {
            input: Buffer.from(overlaySvg),
            top: 0,
            left: 0
        },
        {
            input: resizedProductImage,
            top: 24,
            left: 24
        }
    ];

    if (resizedLogo) {
        compositeImages.push({
            input: resizedLogo,
            top: 28,
            left: 1000
        });
    }

    return sharp({
        create: {
            width: 1200,
            height: 630,
            channels: 4,
            background: "#ffffff"
        }
    })
        .composite(compositeImages)
        .png({
            quality: 92,
            compressionLevel: 8
        })
        .toBuffer();
}

/* =====================================
   NETLIFY HANDLER
===================================== */

exports.handler = async event => {
    const id =
        event.queryStringParameters?.id;

    const imageMode =
        event.queryStringParameters?.image === "1";

    const version =
        event.queryStringParameters?.v || "";

    const versionParam =
        version
            ? `&v=${encodeURIComponent(version)}`
            : "";

    if (!id) {
        return {
            statusCode: 400,
            body: "Missing product ID"
        };
    }

    try {
        const product =
            await getProduct(id);

        if (!product) {
            return {
                statusCode: 404,
                body: "Product not found"
            };
        }

        if (imageMode) {
            return {
                statusCode: 302,
                headers: {
                    Location: FALLBACK_IMAGE,
                    "Cache-Control":
                        "no-store, no-cache, must-revalidate"
                },
                body: ""
            };
        }

        const title =
            product.title ||
            product.name ||
            "Drin Electronics Product";

        const description =
            product.description ||
            "Quality electronics from Drin Electronics.";

        const sharePageUrl =
            `${SITE_URL}/.netlify/functions/product-og` +
            `?id=${encodeURIComponent(id)}` +
            versionParam;

        const previewImageUrl =
            FALLBACK_IMAGE;

        const productUrl =
            `${SITE_URL}/product/index.html` +
            `?id=${encodeURIComponent(id)}`;

        const html = `
      <!DOCTYPE html>
      <html lang="en">

      <head>
        <meta charset="UTF-8" />

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        />

        <title>
          ${escapeHtml(title)} | Drin Electronics
        </title>

        <meta
          name="description"
          content="${escapeHtml(description)}"
        />

        <meta
          property="og:type"
          content="product"
        />

        <meta
          property="og:site_name"
          content="Drin Electronics"
        />

        <meta
          property="og:title"
          content="${escapeHtml(title)}"
        />

        <meta
          property="og:description"
          content="${escapeHtml(description)}"
        />

        <meta
          property="og:url"
          content="${escapeHtml(sharePageUrl)}"
        />

        <meta
          property="og:image"
          content="${escapeHtml(previewImageUrl)}"
        />

        <meta
          property="og:image:secure_url"
          content="${escapeHtml(previewImageUrl)}"
        />

        <meta
          property="og:image:type"
          content="image/png"
        />

        <meta
          property="og:image:width"
          content="1200"
        />

        <meta
          property="og:image:height"
          content="630"
        />

        <meta
          property="og:image:alt"
          content="${escapeHtml(title)}"
        />

        <meta
          name="twitter:card"
          content="summary_large_image"
        />

        <meta
          name="twitter:title"
          content="${escapeHtml(title)}"
        />

        <meta
          name="twitter:description"
          content="${escapeHtml(description)}"
        />

        <meta
          name="twitter:image"
          content="${escapeHtml(previewImageUrl)}"
        />

        <script>
          window.location.replace(
            ${JSON.stringify(productUrl)}
          );
        </script>
      </head>

      <body>
        <p>
          Opening product…
          <a href="${escapeHtml(productUrl)}">
            Continue
          </a>
        </p>
      </body>

      </html>
    `;

        return {
            statusCode: 200,
            headers: {
                "Content-Type":
                    "text/html; charset=UTF-8",

                "Cache-Control":
                    "no-store, no-cache, must-revalidate"
            },
            body: html
        };

    } catch (error) {
        console.error(
            "PRODUCT OG ERROR:",
            error
        );

        return {
            statusCode: 500,
            headers: {
                "Content-Type":
                    "text/plain; charset=UTF-8"
            },
            body:
                error?.message ||
                "Unable to generate product preview"
        };
    }
};