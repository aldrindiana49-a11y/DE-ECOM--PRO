const sharp = require("sharp");

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
    return `₱${safeNumber(value).toLocaleString("en-PH")}`;
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
        wrapTitle(title, 28);

    const {
        regularPrice,
        finalPrice,
        discountPercent,
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
            .resize(630, 530, {
                fit: "contain",
                withoutEnlargement: true,
                kernel: sharp.kernel.lanczos3,
                background: {
                    r: 248,
                    g: 250,
                    b: 252,
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
                .resize(210, 78, {
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
            x="700"
            y="${205 + index * 52}"
            font-family="DejaVu Sans, sans-serif"
            font-size="39"
            font-weight="800"
            fill="#0f172a"
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
          x="700"
          y="447"
          font-family="DejaVu Sans, sans-serif"
          font-size="25"
          font-weight="600"
          fill="#94a3b8"
          text-decoration="line-through"
        >
          ${escapeXml(formatPrice(regularPrice))}
        </text>

        <rect
          x="875"
          y="414"
          width="100"
          height="43"
          rx="21"
          fill="#dc2626"
        />

        <text
          x="925"
          y="444"
          text-anchor="middle"
          font-family="DejaVu Sans, sans-serif"
          font-size="21"
          font-weight="800"
          fill="#ffffff"
        >
          -${discountPercent}%
        </text>
      `
            : "";

    const overlaySvg = `
    <svg
      width="1200"
      height="630"
      viewBox="0 0 1200 630"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient
          id="background"
          x1="0"
          y1="0"
          x2="1"
          y2="1"
        >
          <stop
            offset="0%"
            stop-color="#ffffff"
          />

          <stop
            offset="100%"
            stop-color="#ecfeff"
          />
        </linearGradient>

        <linearGradient
          id="footer"
          x1="0"
          y1="0"
          x2="1"
          y2="0"
        >
          <stop
            offset="0%"
            stop-color="#0891b2"
          />

          <stop
            offset="100%"
            stop-color="#00bcd4"
          />
        </linearGradient>
      </defs>

      <rect
        width="1200"
        height="630"
        fill="url(#background)"
      />

      <rect
        x="28"
        y="26"
        width="1144"
        height="556"
        rx="34"
        fill="#ffffff"
        stroke="#dbeafe"
        stroke-width="2"
      />

      <rect
        x="55"
        y="52"
        width="590"
        height="500"
        rx="27"
        fill="#f8fafc"
      />

      <line
        x1="670"
        y1="82"
        x2="670"
        y2="530"
        stroke="#e2e8f0"
        stroke-width="2"
      />

      <rect
        x="700"
        y="112"
        width="174"
        height="38"
        rx="19"
        fill="#ecfeff"
      />

      <text
        x="787"
        y="138"
        text-anchor="middle"
        font-family="DejaVu Sans, sans-serif"
        font-size="17"
        font-weight="800"
        fill="#0891b2"
      >
        PREMIUM PRODUCT
      </text>

      ${titleSvg}

      <text
        x="700"
        y="402"
        font-family="DejaVu Sans, sans-serif"
        font-size="58"
        font-weight="900"
        fill="#e11d48"
      >
        ${escapeXml(formatPrice(finalPrice))}
      </text>

      ${oldPriceSvg}

      <circle
        cx="713"
        cy="493"
        r="14"
        fill="#10b981"
      />

      <text
        x="713"
        y="500"
        text-anchor="middle"
        font-family="DejaVu Sans, sans-serif"
        font-size="10"
        font-weight="900"
        fill="#ffffff"
      >
        OK
      </text>

      <text
        x="740"
        y="501"
        font-family="DejaVu Sans, sans-serif"
        font-size="21"
        font-weight="700"
        fill="#334155"
      >
        Cash on Delivery Available
      </text>

      <circle
        cx="713"
        cy="535"
        r="14"
        fill="#f59e0b"
      />

      <text
        x="713"
        y="542"
        text-anchor="middle"
        font-family="DejaVu Sans, sans-serif"
        font-size="7"
        font-weight="900"
        fill="#ffffff"
      >
        FAST
      </text>

      <text
        x="740"
        y="543"
        font-family="DejaVu Sans, sans-serif"
        font-size="21"
        font-weight="700"
        fill="#334155"
      >
        Fast &amp; Same Day Delivery
      </text>

      <rect
        x="0"
        y="582"
        width="1200"
        height="48"
        fill="url(#footer)"
      />

      <text
        x="55"
        y="614"
        font-family="DejaVu Sans, sans-serif"
        font-size="19"
        font-weight="700"
        fill="#ffffff"
      >
        Quality Electronics • Trusted Seller
      </text>

      <text
        x="1145"
        y="614"
        text-anchor="end"
        font-family="DejaVu Sans, sans-serif"
        font-size="19"
        font-weight="700"
        fill="#ffffff"
      >
        drinelectronicsph.com
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
            top: 38,
            left: 35
        }
    ];

    if (resizedLogo) {
        compositeImages.push({
            input: resizedLogo,
            top: 40,
            left: 930
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
            const image =
                await generatePremiumCard(product);

            return {
                statusCode: 200,
                headers: {
                    "Content-Type": "image/png",
                    "Cache-Control":
                        "no-store, no-cache, must-revalidate"
                },
                body: image.toString("base64"),
                isBase64Encoded: true
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
            `${SITE_URL}/.netlify/functions/product-og` +
            `?id=${encodeURIComponent(id)}` +
            `&image=1` +
            versionParam;

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