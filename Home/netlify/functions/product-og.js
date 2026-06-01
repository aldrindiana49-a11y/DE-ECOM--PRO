exports.handler = async (event) => {

    const id = event.queryStringParameters.id;

    if (!id) {
        return {
            statusCode: 400,
            body: "Missing product ID"
        };
    }

    const SUPABASE_URL = "https://zdinvxowzpkolbfzpcac.supabase.co";

    const SUPABASE_KEY = "sb_publishable_yWOmkaQzsh7sInJPhDOFWw_tyjALAuP";

    try {

        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(id)}&select=*`,
            {
                headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`
                }
            }
        );


        const data = await response.json();

        const product = data[0];

        if (!product) {
            return {
                statusCode: 404,
                body: "Product not found"
            };
        }

        const price =
            product.discount_price ||
            product.price ||
            "";

        const title =
            product.title ||
            product.name ||
            product.brand ||
            "Drin Electronics";

        const description =
            `${product.brand || "Drin Electronics"}${price ? " • ₱" + Number(price).toLocaleString() : ""}`;

        const image =
            product.gallery?.[0] ||
            "https://drinelectronicsph.com/Image/social-preview.png";

        const url =
            `https://drinelectronicsph.com/product/index.html?id=${id}`;

        const html = `
      <!DOCTYPE html>
      <html>
      <head>

        <title>${title}</title>

        <meta property="og:title" content="${title}" />
        <meta property="og:description" content="${description}" />
        <meta property="og:image" content="${image}" />
        <meta property="og:url" content="https://drinelectronicsph.com/.netlify/functions/product-og?id=${id}" />
        <meta property="og:type" content="website" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="${title}" />
        <meta name="twitter:description" content="${description}" />
        <meta name="twitter:image" content="${image}" />

      </head>
      
<body>
  <script>
    const isBot = /facebookexternalhit|Facebot|Twitterbot|LinkedInBot|WhatsApp|TelegramBot/i.test(navigator.userAgent);

    if (!isBot) {
      window.location.href = "${url}";
    }
  </script>

  <a href="${url}">View Product</a>
</body>

      </html>
    `;

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "text/html"
            },
            body: html
        };

    } catch (err) {

        return {
            statusCode: 500,
            body: err.toString()
        };

    }

};