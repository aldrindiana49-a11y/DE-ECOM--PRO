const buyNowBtn =
  document.getElementById("buyNowBtn");

buyNowBtn?.addEventListener(
  "click",
  () => {

    if (productsLoading) return;

    const stock =
      getProductStock(product);

    const qty =
      validateQuantity();

    const variants =
      getVariants(product);

    if (
      variants.length > 1 &&
      !selectedVariant
    ) {

      showMessage(
        `Please select ${product.variantTitle || "variation"}.`,
        "error"
      );

      variantContainer?.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });

      return;
    }

    if (stock <= 0) {

      showMessage(
        "Out of stock.",
        "error"
      );

      return;
    }

    const selectedVariantLabel =
      selectedVariant?.label || "";

    const selectedStock =
      selectedVariant
        ? safeNumber(selectedVariant.stock)
        : stock;

    const selectedPrice =
      selectedVariant
        ? (
          safeNumber(selectedVariant.discountPrice) > 0
            ? safeNumber(selectedVariant.discountPrice)
            : safeNumber(selectedVariant.price)
        )
        : getProductPrice(product);

    const selectedImage =
      selectedVariant?.image ||
      getProductImage(product);

    const checkoutItem = {

      weight:
        selectedVariant?.weight ||
        product.weight ||
        0.5,

      length:
        selectedVariant?.length ||
        product.length ||
        10,

      width:
        selectedVariant?.width ||
        product.width ||
        10,

      height:
        selectedVariant?.height ||
        product.height ||
        10,

      id: product.id,

      name: product.name,

      variantLabel:
        selectedVariantLabel,

      price: selectedPrice,

      image: selectedImage,

      variant_image:
        selectedImage,

      product_image:
        product.image,

      stock: selectedStock,

      quantity: qty,

      selected: true
    };

    localStorage.setItem(
      "drinCheckoutItems",
      JSON.stringify([checkoutItem])
    );

    window.location.href =
      "../Cart/Checkout/";
  }
);