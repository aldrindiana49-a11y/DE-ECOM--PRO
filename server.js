require("dotenv").config(); // ✅ DAPAT NASA UNANG LINE

const {
  spxPost,
  verifyAccount,
  checkShippingFee,
  createOrder,
  getCreateResult,
  getAWB
} = require("./services/spxService");

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const CryptoJS = require("crypto-js");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

function generateLalamoveSignature(method, path, body = "") {
  const time = new Date().getTime().toString();

  const rawSignature =
    `${time}\r\n${method}\r\n${path}\r\n\r\n${body}`;

  const signature = CryptoJS
    .HmacSHA256(
      rawSignature,
      process.env.LALAMOVE_SECRET
    )
    .toString();

  return {
    time,
    signature
  };
}

const ORDERS_FILE = path.join(__dirname, "data", "orders.json");

function ensureOrdersFile() {
  const dir = path.dirname(ORDERS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, "[]");
}

async function readOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("SUPABASE READ ORDERS ERROR:", error);
    return [];
  }

  return data || [];
}

async function saveOrders(orders) {
  for (const order of orders) {
    const { error } = await supabase
      .from("orders")
      .upsert(order, {
        onConflict: "external_id"
      });

    if (error) {
      console.error("SUPABASE SAVE ORDER ERROR:", error);
      throw error;
    }
  }
}

async function savePendingOrder({
  orderId,
  amount,
  subtotal,
  shippingFee,
  serviceFee,
  handlingFee,
  customerName,
  customerPhone,
  customerEmail,
  guestOrder,
  guestTrackingCode,
  items,
  paymentProvider,
  checkoutUrl,
  address,
  parcelInfo,
  courier
}) {
  let orders = await readOrders();

  const orderData = {
    external_id: orderId,
    amount: Number(amount),
    subtotal: Number(subtotal || amount || 0),
    shipping_fee: Number(shippingFee || 0),
    service_fee: Number(
      serviceFee ??
      handlingFee ??
      0
    ),
    customer_name: customerName || "Customer",
    customer_phone: customerPhone || "",
    customer_email: customerEmail || "",
    guest_order: guestOrder === true,
    guest_tracking_code: guestTrackingCode || "",
    address: address || {},
    parcel_info: parcelInfo || {},
    items: (() => {
      if (Array.isArray(items)) {
        return items;
      }

      if (typeof items === "string") {
        try {
          const parsedItems = JSON.parse(items);

          return Array.isArray(parsedItems)
            ? parsedItems
            : [];
        } catch (error) {
          console.error("INVALID ORDER ITEMS JSON:", error);
          return [];
        }
      }

      return [];
    })(),
    payment_provider: paymentProvider,
    courier: courier || "",
    checkout_url: checkoutUrl || "",
    status: "Pending Payment",
    order_status: paymentProvider === "COD"
      ? "Pending"
      : "Pending Payment",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const existingIndex = orders.findIndex(order => order.external_id === orderId);

  if (existingIndex !== -1) {
    const existingOrder = orders[existingIndex];

    const existingItems =
      Array.isArray(existingOrder.items)
        ? existingOrder.items
        : [];

    const incomingItems =
      Array.isArray(orderData.items)
        ? orderData.items
        : [];

    orders[existingIndex] = {
      ...existingOrder,
      ...orderData,

      items:
        incomingItems.length >= existingItems.length
          ? incomingItems
          : existingItems
    };
  } else {
    orders.push(orderData);
  }

  await saveOrders(orders);

  return existingIndex !== -1
    ? orders[existingIndex]
    : orderData;
}

async function reserveXenditStock(order) {

  if (!order || order.stock_reserved) return order;

  for (const item of order.items || []) {

    const finalProductId =
      item.productId ||
      item.product_id ||
      item.productID ||
      item.id;

    const finalVariantLabel =
      item.variantLabel ||
      item.variant ||
      item.variation ||
      item.variant_name ||
      item.variantName ||
      item.option ||
      item.label ||
      "Default";

    const finalQuantity = Number(
      item.quantity ||
      item.qty ||
      item.quantityOrdered ||
      1
    );

    console.log("STOCK DEBUG RESERVE:", {
      orderId: order.external_id || order.id,
      finalProductId,
      finalVariantLabel,
      finalQuantity,
      item
    });

    const { error } = await supabase.rpc("deduct_stock", {
      p_product_id: finalProductId,
      p_variant_label: finalVariantLabel,
      p_quantity: finalQuantity,
      p_order_id: String(order.external_id || order.id)
    });

    if (error) throw error;
  }

  order.stock_reserved = true;
  order.stock_restored = false;
  order.stock_reserved_at = new Date().toISOString();
  order.updated_at = new Date().toISOString();

  return order;
}

async function restoreXenditStock(order) {
  if (!order || order.stock_restored) return order;

  for (const item of order.items || []) {

    const finalProductId =
      item.productId ||
      item.product_id ||
      item.productID ||
      item.id;

    const finalVariantLabel =
      item.variantLabel ||
      item.variant ||
      item.variation ||
      item.variant_name ||
      item.variantName ||
      item.option ||
      item.label ||
      "Default";

    const finalQuantity = Number(
      item.quantity ||
      item.qty ||
      item.quantityOrdered ||
      1
    );

    console.log("STOCK DEBUG RESTORE:", {
      orderId: order.external_id || order.id,
      finalProductId,
      finalVariantLabel,
      finalQuantity,
      item
    });

    const { error } = await supabase.rpc("restore_stock", {
      p_product_id: finalProductId,
      p_variant_label: finalVariantLabel,
      p_quantity: finalQuantity,
      p_order_id: String(order.external_id || order.id)
    });

    if (error) throw error;
  }

  order.stock_reserved = false;
  order.stock_restored = true;
  order.stock_restored_at = new Date().toISOString();
  order.updated_at = new Date().toISOString();

  return order;
}


// ================= ROOT =================
app.get("/", (req, res) => {
  res.send("🔥 Server Running");
});

// ================= SPX CREATE ACCOUNT =================
app.post("/api/spx/create-account", async (req, res) => {
  try {
    const { phone, email } = req.body;

    const result = await spxPost("/open/api/v1/account/create", {
      phone,
      email
    });

    res.json(result);

  } catch (err) {
    console.error("SPX CREATE ACCOUNT ERROR:", err.response?.data || err.message);

    res.status(500).json({
      success: false,
      message: "SPX create account failed",
      error: err.response?.data || err.message
    });
  }
});

// ================= SPX VERIFY =================
app.get("/api/spx/verify", async (req, res) => {
  try {
    const result = await verifyAccount();
    res.json(result);
  } catch (err) {
    console.error("SPX VERIFY ERROR:", err.response?.data || err.message);

    res.status(500).json({
      success: false,
      message: "SPX verify failed",
      error: err.response?.data || err.message
    });
  }
});

// ================= SPX ADDRESS DOWNLOAD URL =================
app.post("/api/spx/address-download-url", async (req, res) => {
  try {
    const result = await spxPost("/open/api/address/get_address_download_url", {});
    res.json(result);
  } catch (err) {
    console.error("SPX ADDRESS URL ERROR:", err.response?.data || err.message);

    res.status(500).json({
      success: false,
      message: "SPX address download URL failed",
      error: err.response?.data || err.message
    });
  }
});


// ================= SPX CHECK SHIPPING FEE =================

app.post("/api/spx/check-shipping-fee", async (req, res) => {
  try {
    const { amount, paymentMethod, address, parcelInfo, voucherCode, baseInfo, base_info } = req.body;

    const result = await checkShippingFee({
      amount,
      paymentMethod,
      address,
      parcelInfo,
      voucherCode,
      baseInfo: baseInfo || base_info
    });

    if (result.ret_code !== 0) {
      return res.status(400).json({
        success: false,
        message: result.message || "SPX shipping fee check failed",
        spx: result
      });
    }

    const orderFee = result?.data?.orders?.[0];
    const fail = result?.data?.fail_list?.[0];

    if (!orderFee) {
      return res.status(400).json({
        success: false,
        message: fail?.debug_msg || fail?.message || "SPX could not calculate shipping fee",
        spx: result
      });
    }

    res.json({
      success: true,
      shippingFee: Number(orderFee.estimated_shipping_fee || 0),
      basicShippingFee: Number(orderFee.basic_shipping_fee || 0),
      codServiceFee: Number(orderFee.cod_service_fee || 0),
      insuranceServiceFee: Number(orderFee.insurance_service_fee || 0),
      voucherShippingFee: Number(orderFee.voucher_shipping_fee || 0),
      edtMin: orderFee.edt_min,
      edtMax: orderFee.edt_max,
      spx: result
    });
  } catch (err) {
    console.error("SPX CHECK SHIPPING FEE ERROR:", err.response?.data || err.message);

    res.status(500).json({
      success: false,
      message: "SPX shipping fee check failed",
      error: err.response?.data || err.message
    });
  }
});


// ================= SPX CREATE ORDER =================
app.post("/api/spx/create", async (req, res) => {
  try {
    const order = req.body;

    const result = await createOrder(order);

    res.json(result);
  } catch (err) {
    console.error("SPX CREATE ORDER ERROR:", err.response?.data || err.message);

    res.status(500).json({
      success: false,
      message: "SPX create order failed",
      error: err.response?.data || err.message
    });
  }
});

// ================= SPX GET CREATE RESULT =================
app.post("/api/spx/result", async (req, res) => {
  try {
    const { batchNo } = req.body;

    const result = await getCreateResult(batchNo);

    res.json(result);
  } catch (err) {
    console.error("SPX GET RESULT ERROR:", err.response?.data || err.message);

    res.status(500).json({
      success: false,
      message: "SPX get result failed",
      error: err.response?.data || err.message
    });
  }
});

// ================= SPX GET AWB =================
app.post("/api/spx/awb", async (req, res) => {
  try {
    const { batchNo } = req.body;

    const result = await getAWB(batchNo);

    res.json(result);
  } catch (err) {
    console.error("SPX AWB ERROR:", err.response?.data || err.message);

    res.status(500).json({
      success: false,
      message: "SPX get AWB failed",
      error: err.response?.data || err.message
    });
  }
});

// ================= SPX CREATE + SAVE TRACKING + AWB =================
app.post("/api/orders/:orderId/spx-create", async (req, res) => {
  try {
    const { orderId } = req.params;

    let orders = await readOrders();
    const index = orders.findIndex(
      order => String(order.external_id) === String(orderId)
    );

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    const order = orders[index];

    const savedAddress = order.address || {};
    const savedParcel = order.parcel_info || {};

    const spxPayload = {
      _id: order.external_id,
      paymentMethod: order.payment_provider === "COD" ? "COD" : "PAID",
      totalAmount: order.amount,
      customerName: order.customer_name,
      phone: order.customer_phone || "639123456789",
      address: savedAddress,

      deliverState: savedAddress.province || "Metro Manila",
      deliverCity: savedAddress.city || "Metro Manila",
      deliverDistrict: savedAddress.barangay || "Intramuros",
      deliverStreet: savedAddress.barangay || "Barangay 654",
      deliverPostCode: savedAddress.postCode || savedAddress.zipCode || "1002",

      parcelWeight: savedParcel.parcelWeight || 1,
      parcelLength: savedParcel.parcelLength || 10,
      parcelWidth: savedParcel.parcelWidth || 10,
      parcelHeight: savedParcel.parcelHeight || 10,
      parcelItemName: savedParcel.itemName || "Electronics",
      parcelItemQuantity: savedParcel.itemQuantity || (order.items?.length || 1),
      parcelItemType: savedParcel.itemType || "Electronics",

      items: order.items || [{ name: "Electronics" }]
    };

    const createResult = await createOrder(spxPayload);

    if (createResult.ret_code !== 0) {
      return res.status(400).json({
        success: false,
        message: "SPX create order failed",
        spx: createResult
      });
    }

    const batchNo = createResult.data.batch_no;

    // Wait a little before getting result
    await new Promise(resolve => setTimeout(resolve, 3000));

    const result = await getCreateResult(batchNo);

    console.log(
      "SPX CREATE RESULT FULL:",
      JSON.stringify(result, null, 2)
    );

    if (result.data?.success_count < 1) {
      orders[index].spx_batch_no = batchNo;
      orders[index].shipping_status = "SPX_FAILED";
      orders[index].spx_error = result.data?.fail_list?.[0]?.message || "SPX failed";
      orders[index].updated_at = new Date().toISOString();

      await saveOrders(orders);

      return res.status(400).json({
        success: false,
        message: "SPX order failed",
        batchNo,
        spx: result
      });
    }

    const spxOrder = result.data.orders[0];

    const awb = await getAWB(batchNo);

    orders[index].courier = "SPX";
    orders[index].spx_batch_no = batchNo;
    orders[index].tracking_number = spxOrder.tracking_no;
    orders[index].tracking_link = spxOrder.tracking_link || spxOrder.tracking_no_link;
    orders[index].awb_link = awb.data?.awb_link || "";
    orders[index].shipping_fee = spxOrder.estimated_shipping_fee || 0;
    orders[index].shipping_status = "PENDING_PICKUP";
    orders[index].order_status = "Ready to Ship";
    orders[index].updated_at = new Date().toISOString();

    await saveOrders(orders);

    res.json({
      success: true,
      message: "SPX shipment created",
      order: orders[index]
    });

  } catch (err) {
    console.error("SPX SAVE ORDER ERROR:", err.response?.data || err.message);

    res.status(500).json({
      success: false,
      message: "SPX shipment failed",
      error: err.response?.data || err.message
    });
  }
});

// ================= COD ORDER SAVE =================
app.post("/api/orders/cod", async (req, res) => {
  try {
    const {
      orderId,
      amount,
      subtotal,
      shippingFee,
      serviceFee,
      handlingFee,
      customerName,
      customerPhone,
      customerEmail,
      guestOrder,
      guestTrackingCode,
      items,
      address,
      parcelInfo,
      courier
    } = req.body;

    let order = await savePendingOrder({
      orderId,
      amount,
      subtotal,
      shippingFee,
      serviceFee,
      handlingFee,
      customerName,
      customerPhone,
      customerEmail,
      guestOrder,
      guestTrackingCode,
      items,
      paymentProvider: "COD",
      checkoutUrl: "",
      address,
      parcelInfo,
      courier
    });

    let orders = await readOrders();
    const index = orders.findIndex(item => item.external_id === orderId);

    if (index !== -1) {
      orders[index].status = "COD";
      orders[index].order_status = "Pending";
      orders[index].updated_at = new Date().toISOString();

      await saveOrders(orders);
    }

    res.json({
      success: true,
      order: index !== -1 ? orders[index] : order
    });

  } catch (err) {
    console.error("COD ORDER SAVE ERROR:", err);

    res.status(500).json({
      success: false,
      message: "COD order save failed"
    });
  }
});

// ================= SKYRO TEST MODE =================
app.post("/api/skyro/test-create-order", async (req, res) => {
  try {
    const {
      orderId,
      amount,
      subtotal,
      shippingFee,
      serviceFee,
      handlingFee,
      customerName,
      customerPhone,
      customerEmail,
      guestOrder,
      guestTrackingCode,
      items,
      address,
      parcelInfo,
      courier
    } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Missing order ID"
      });
    }

    if (!Number(amount) || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid order amount"
      });
    }

    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({
        success: false,
        message: "No order items found"
      });
    }

    const skyroOrderId =
      `TEST-SKYRO-${Date.now()}`;

    let order = await savePendingOrder({
      orderId,
      amount,
      subtotal,
      shippingFee,
      serviceFee,
      handlingFee,

      customerName,
      customerPhone,
      customerEmail,

      guestOrder,
      guestTrackingCode,

      items,
      address,
      parcelInfo,
      courier,

      paymentProvider: "SKYRO",

      checkoutUrl:
        "https://drinelectronicsph.com/home-orders/?skyro=test"
    });

    order.payment_provider = "SKYRO";
    order.status = "Pending Payment";
    order.order_status = "Installment Application";
    order.updated_at = new Date().toISOString();

    await saveOrders([order]);

    return res.json({
      success: true,
      testMode: true,
      skyroOrderId,

      checkoutUrl:
        "https://drinelectronicsph.com/home-orders/?skyro=test",

      order
    });

  } catch (error) {
    console.error("SKYRO TEST ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Skyro test order failed",
      error: error.message
    });
  }
});

// ================= XENDIT =================
app.post("/api/create-payment", async (req, res) => {
  try {
    const {
      orderId,
      guestOrder,
      guestTrackingCode,
      amount,
      subtotal,
      shippingFee,
      serviceFee,
      handlingFee,
      customerName,
      customerPhone,
      customerEmail,
      items,
      address,
      parcelInfo,
      courier
    } = req.body;

    const successRedirectUrl =
      guestOrder === true
        ? "https://drinelectronicsph.com/guest-track/?payment=success"
        : "https://drinelectronicsph.com/home-orders/";

    const response = await fetch("https://api.xendit.co/v2/invoices", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:
          "Basic " + Buffer.from(`${process.env.XENDIT_SECRET_KEY}:`).toString("base64")
      },
      body: JSON.stringify({
        external_id: orderId,
        amount: Number(amount),
        currency: "PHP",
        description: `Order ${orderId}`,
        customer: {
          given_names: customerName || "Customer",
          mobile_number: customerPhone || ""
        },
        success_redirect_url: successRedirectUrl,
        failure_redirect_url: "https://drinelectronicsph.com/Checkout/checkout.html"
      })
    });

    const data = await response.json();

    if (!response.ok || !data.invoice_url) {
      return res.status(400).json({
        success: false,
        message: "Xendit checkout failed.",
        data
      });
    }

    let order = await savePendingOrder({
      orderId,
      amount,
      customerName,
      customerPhone,
      customerEmail,
      guestOrder,
      guestTrackingCode,
      items,
      paymentProvider: "XENDIT",
      address,
      parcelInfo,
      subtotal,
      shippingFee,
      serviceFee,
      handlingFee,
      courier,
      checkoutUrl: data.invoice_url
    });

    order = await reserveXenditStock(order);
    await saveOrders([order]);


    res.json({
      success: true,
      checkoutUrl: data.invoice_url,
      order
    });

  } catch (err) {
    console.error("XENDIT FULL ERROR:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
      stack: err.stack
    });

    res.status(500).json({
      success: false,
      message: "Xendit failed",
      error: err.response?.data || err.message
    });
  }

});

// ================= MAYA =================
app.post("/api/create-maya-payment", async (req, res) => {
  try {
    const {
      orderId,
      amount,
      subtotal,
      shippingFee,
      customerName,
      customerPhone,
      items,
      address,
      parcelInfo
    } = req.body;

    const payload = {
      totalAmount: {
        value: Number(amount),
        currency: "PHP"
      },
      buyer: {
        firstName: customerName || "Customer",
        contact: {
          phone: customerPhone || "09000000000"
        }
      },
      redirectUrl: {
        success: "https://drinelectronicsph.com/Home/index.html",
        failure: "https://drinelectronicsph.com/Checkout/checkout.html",
        cancel: "https://drinelectronicsph.com/Checkout/checkout.html"
      },
      requestReferenceNumber: orderId
    };

    const auth = Buffer.from(
      `${process.env.MAYA_PUBLIC_KEY}:${process.env.MAYA_SECRET_KEY}`
    ).toString("base64");

    const response = await fetch("https://pg.maya.ph/checkout/v1/checkouts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Basic " + auth
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok || !data.redirectUrl) {
      return res.status(400).json({
        success: false,
        message: "Maya checkout failed.",
        data
      });
    }

    const order = await savePendingOrder({
      orderId,
      amount,
      customerName,
      customerPhone,
      items,
      paymentProvider: "MAYA",
      address,
      parcelInfo,
      subtotal,
      shippingFee,
      checkoutUrl: data.redirectUrl
    });

    res.json({
      success: true,
      checkoutUrl: data.redirectUrl,
      order
    });
  } catch (err) {
    console.error("MAYA ERROR:", err);
    res.status(500).json({ success: false, message: "Maya failed" });
  }
});

// ================= VIEW ACTIVE ORDERS =================
app.get("/api/orders", async (req, res) => {
  try {
    const orders = await readOrders();

    // Hide cancelled orders from main dashboard
    const activeOrders = orders.filter(order => {
      return order.order_status !== "Cancelled";
    });

    res.json({
      success: true,
      orders: activeOrders
    });

  } catch (err) {
    console.error("GET ORDERS ERROR:", err);

    res.status(500).json({
      success: false,
      message: "Failed to load orders"
    });
  }
});

// ================= UPDATE ORDER =================
app.post("/api/orders/update", async (req, res) => {
  try {

    const {
      orderId,
      order_status,
      tracking_number,
      courier,
      skyro_application_link
    } = req.body;

    let orders = await readOrders();
    const index = orders.findIndex(
      order => String(order.external_id) === String(orderId)
    );

    if (index === -1) {
      return res.json({
        success: false,
        message: "Order not found"
      });
    }

    if (order_status) {
      orders[index].order_status = order_status;

      if (
        String(order_status).toLowerCase() === "cancelled" &&
        orders[index].stock_restored !== true
      ) {
        try {
          await restoreXenditStock({
            ...orders[index],
            stock_reserved: true
          });

          orders[index].stock_reserved = false;
          orders[index].stock_restored = true;
          orders[index].stock_restored_at = new Date().toISOString();

        } catch (stockErr) {
          console.error("UPDATE CANCEL RESTORE STOCK ERROR:", stockErr);
        }
      }
    }
    if (tracking_number !== undefined) orders[index].tracking_number = tracking_number;
    if (courier !== undefined) orders[index].courier = courier;

    if (skyro_application_link !== undefined) {
      orders[index].skyro_application_link =
        String(skyro_application_link).trim();
    }

    orders[index].updated_at = new Date().toISOString();

    await saveOrders(orders);

    res.json({
      success: true,
      order: orders[index]
    });
  } catch (err) {
    console.error("UPDATE ORDER ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Update failed"
    });
  }
});

// ================= CANCEL ORDER =================
app.post("/api/orders/:orderId/cancel", async (req, res) => {
  try {
    const { orderId } = req.params;

    const {
      cancel_reason,
      cancel_type,
      cancelled_by
    } = req.body;

    let orders = await readOrders();

    const index = orders.findIndex(
      order => String(order.external_id) === String(orderId)
    );

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    orders[index].order_status = "Cancelled";

    orders[index].cancel_type =
      cancel_type || "Seller Forced Cancel";

    orders[index].cancel_reason =
      cancel_reason || "No reason provided";

    orders[index].cancelled_by =
      cancelled_by || "seller";

    orders[index].cancelled_at =
      new Date().toISOString();

    orders[index].updated_at =
      new Date().toISOString();

    if (orders[index].stock_restored !== true) {
      try {

        await restoreXenditStock({
          ...orders[index],
          stock_reserved: true
        });

        orders[index].stock_reserved = false;
        orders[index].stock_restored = true;
        orders[index].stock_restored_at = new Date().toISOString();
        orders[index].updated_at = new Date().toISOString();

      } catch (stockErr) {
        console.error("RESTORE STOCK ERROR:", stockErr);
      }
    }

    await saveOrders(orders);

    res.json({
      success: true,
      message: "Order cancelled successfully",
      order: orders[index]
    });

  } catch (err) {
    console.error("CANCEL ORDER ERROR:", err);

    res.status(500).json({
      success: false,
      message: "Cancel order failed"
    });
  }
});

// ================= EXPIRE PAYMENT =================
app.post("/api/orders/:orderId/expire-payment", async (req, res) => {
  try {
    const { orderId } = req.params;

    let orders = await readOrders();

    const index = orders.findIndex(
      order => String(order.external_id) === String(orderId) ||
        String(order.id) === String(orderId)
    );

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    if (orders[index].stock_restored !== true) {
      try {
        await restoreXenditStock({
          ...orders[index],
          stock_reserved: true
        });

        orders[index].stock_reserved = false;
        orders[index].stock_restored = true;
        orders[index].stock_restored_at = new Date().toISOString();

      } catch (stockErr) {
        console.error("EXPIRE PAYMENT RESTORE STOCK ERROR:", stockErr);
      }
    }

    orders[index].status = "PAYMENT_EXPIRED";
    orders[index].payment_status = "PAYMENT_EXPIRED";
    orders[index].order_status = "Payment Expired";
    orders[index].expired_at = new Date().toISOString();
    orders[index].updated_at = new Date().toISOString();

    await saveOrders(orders);

    res.json({
      success: true,
      message: "Payment expired and stock restored",
      order: orders[index]
    });

  } catch (err) {
    console.error("EXPIRE PAYMENT ERROR:", err);

    res.status(500).json({
      success: false,
      message: "Expire payment failed"
    });
  }
});

// ================= GET CANCELLED ORDERS =================
app.get("/api/orders/cancelled", async (req, res) => {
  try {
    const orders = await readOrders();

    const cancelledOrders = orders.filter(order =>
      order.order_status === "Cancelled"
    );

    res.json({
      success: true,
      orders: cancelledOrders
    });

  } catch (err) {
    console.error("GET CANCELLED ORDERS ERROR:", err);

    res.status(500).json({
      success: false,
      message: "Failed to get cancelled orders"
    });
  }
});

// ================= DELETE ORDER PERMANENT =================
app.delete("/api/orders/:orderId/delete", async (req, res) => {
  try {
    const { orderId } = req.params;

    let orders = await readOrders();

    const index = orders.findIndex(
      order => String(order.external_id) === String(orderId)
    );

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    const deletedOrder = orders[index];

    orders.splice(index, 1);

    await saveOrders(orders);

    res.json({
      success: true,
      message: "Order permanently deleted",
      order: deletedOrder
    });

  } catch (err) {
    console.error("DELETE ORDER ERROR:", err);

    res.status(500).json({
      success: false,
      message: "Delete order failed"
    });
  }
});

// ================= PAYMENT WEBHOOK HELPERS =================
function findOrderIndex(orders, orderId) {
  return orders.findIndex(order => String(order.external_id) === String(orderId));
}

function markOrderPaid(order, provider, meta = {}) {
  order.status = "PAID";
  order.payment_status = "PAID";
  order.payment_provider = order.payment_provider || provider;
  order.order_status = "Processing";
  order.paid_at = order.paid_at || new Date().toISOString();
  order.updated_at = new Date().toISOString();

  Object.assign(order, meta);
}

function markOrderPaymentFailed(order, provider, status, meta = {}) {
  order.status = status || "PAYMENT_FAILED";
  order.payment_status = status || "PAYMENT_FAILED";
  order.payment_provider = order.payment_provider || provider;

  if (["PAYMENT_FAILED", "PAYMENT_EXPIRED", "PAYMENT_CANCELLED", "EXPIRED", "FAILED"].includes(status)) {
    order.order_status = status === "PAYMENT_EXPIRED" || status === "EXPIRED"
      ? "Payment Expired"
      : "Payment Failed";
  }

  order.updated_at = new Date().toISOString();
  Object.assign(order, meta);
}

function respondWebhookOk(res, extra = {}) {
  return res.status(200).json({
    success: true,
    message: "Webhook processed",
    ...extra
  });
}

// ================= MAYA WEBHOOK =================
app.post("/webhook", async (req, res) => {
  try {
    const data = req.body || {};
    console.log("MAYA WEBHOOK RECEIVED:", data);

    const orderId = data.requestReferenceNumber;
    const mayaStatus = data.status || data.paymentStatus || "UNKNOWN";
    const isPaid =
      data.isPaid === true ||
      mayaStatus === "PAYMENT_SUCCESS" ||
      mayaStatus === "CHECKOUT_SUCCESS";

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Missing requestReferenceNumber"
      });
    }

    let orders = await readOrders();
    const index = findOrderIndex(orders, orderId);

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    const meta = {
      maya_status: mayaStatus,
      maya_webhook_id: data.id || data.webhookId || "",
      maya_transaction_id: data.receipt?.transactionId || data.paymentId || data.transactionId || "",
      maya_receipt_number: data.receiptNumber || data.receipt?.receiptNo || "",
      maya_raw_webhook: data
    };

    if (isPaid) {
      markOrderPaid(orders[index], "MAYA", meta);
    } else {
      markOrderPaymentFailed(orders[index], "MAYA", mayaStatus, meta);
    }

    await saveOrders(orders);

    return respondWebhookOk(res, {
      provider: "MAYA",
      orderId,
      status: orders[index].status,
      order_status: orders[index].order_status
    });

  } catch (err) {
    console.error("MAYA WEBHOOK ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Maya webhook failed"
    });
  }
});

// ================= XENDIT WEBHOOK =================
app.post("/api/xendit/webhook", async (req, res) => {
  try {
    const data = req.body || {};
    console.log("XENDIT WEBHOOK RECEIVED:", data);

    const payload = data.data || data;
    const orderId =
      payload.external_id ||
      payload.reference_id ||
      payload.payment_request_id ||
      payload.id;

    const xenditStatus = String(payload.status || data.event || "UNKNOWN").toUpperCase();

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Missing Xendit order reference"
      });
    }

    let orders = await readOrders();
    const index = findOrderIndex(orders, orderId);

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    const meta = {
      xendit_status: xenditStatus,
      xendit_invoice_id: payload.id || data.id || "",
      xendit_payment_id:
        payload.payment_id ||
        payload.payment_method_id ||
        payload.payment_request_id ||
        "",
      xendit_raw_webhook: data
    };

    const paidStatuses = [
      "PAID",
      "SETTLED",
      "SUCCEEDED",
      "SUCCESS",
      "COMPLETED",
      "PAYMENT.SUCCEEDED",
      "INVOICE.PAID"
    ];

    if (paidStatuses.includes(xenditStatus)) {
      markOrderPaid(orders[index], "XENDIT", meta);

    } else if (["EXPIRED", "FAILED", "VOIDED", "CANCELLED", "CANCELED"].includes(xenditStatus)) {

      markOrderPaymentFailed(orders[index], "XENDIT", xenditStatus, meta);

      try {
        await restoreXenditStock(orders[index]);
      } catch (stockErr) {
        console.error("XENDIT RESTORE STOCK ERROR:", stockErr);
      }

    } else {
      orders[index].xendit_status = xenditStatus;
      orders[index].xendit_raw_webhook = data;
      orders[index].updated_at = new Date().toISOString();
    }

    await saveOrders(orders);

    return respondWebhookOk(res, {
      provider: "XENDIT",
      orderId,
      status: orders[index].status,
      order_status: orders[index].order_status
    });

  } catch (err) {
    console.error("XENDIT WEBHOOK ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Xendit webhook failed"
    });
  }
});

// Optional alias para Maya dashboard
app.post("/api/maya/webhook", (req, res) => {
  req.url = "/webhook";
  return app.handle(req, res);
});

// ================= SPX ADDRESS FILE DOWNLOAD =================

app.get("/api/spx/address-file", async (req, res) => {
  try {

    const result = await spxPost(
      "/open/api/address/get_address_download_url",
      {}
    );

    const fileUrl =
      result?.data?.address_download_url ||
      result?.data?.download_url ||
      result?.data?.url;

    if (!fileUrl) {
      return res.status(400).json({
        success: false,
        message: "No address file URL returned",
        fullSpxResponse: result
      });
    }

    return res.redirect(fileUrl);

  } catch (err) {

    console.error(
      "SPX ADDRESS FILE ERROR:",
      err.response?.data || err.message
    );

    return res.status(500).json({
      success: false,
      message: "SPX address file download failed",
      error: err.response?.data || err.message
    });

  }
});

// ===== TEST WEBHOOK =====
app.post("/test-webhook", (req, res) => {
  console.log("TEST WEBHOOK RECEIVED:", req.body);
  res.status(200).json({
    success: true,
    message: "Test webhook working",
    body: req.body
  });
});

// ================= LOCATION SEARCH PROXY =================
app.get("/api/location-search", async (req, res) => {
  try {
    const q = req.query.q;

    if (!q || q.length < 4) {
      return res.json([]);
    }

    const url =
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q + ", Philippines")}&limit=3`;

    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 DrinElectronics contact@drinelectronicsph.com"
      },
      timeout: 5000
    });

    res.json(response.data);

  } catch (error) {
    console.error(
      "LOCATION SEARCH ERROR FULL:",
      error.response?.data || error.message
    );

    res.status(500).json({
      success: false,
      message: "Location search failed"
    });
  }
});

// ================= LALAMOVE QUOTATION =================
app.post("/api/lalamove/quotation", async (req, res) => {
  try {
    const path = "/v3/quotations";
    const method = "POST";

    const body = JSON.stringify(req.body);

    const { time, signature } =
      generateLalamoveSignature(method, path, body);

    const response = await axios.post(
      `${process.env.LALAMOVE_BASE_URL}${path}`,
      body,
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Authorization: `hmac ${process.env.LALAMOVE_API_KEY}:${time}:${signature}`,
          Market: process.env.LALAMOVE_MARKET || "PH",
          "Request-ID": `drin-${Date.now()}`
        }
      }
    );

    res.json({
      success: true,
      data: response.data
    });

  } catch (err) {
    console.error("LALAMOVE QUOTATION ERROR:", err.response?.data || err.message);

    res.status(500).json({
      success: false,
      message: "Lalamove quotation failed",
      error: err.response?.data || err.message
    });
  }
});

// ================= LALAMOVE CREATE ORDER =================
app.post("/api/orders/:orderId/lalamove-create", async (req, res) => {
  try {
    const { orderId } = req.params;

    let orders = await readOrders();

    const index = orders.findIndex(
      order => String(order.external_id) === String(orderId)
    );

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    const order = orders[index];

    const savedAddress = order.address || {};

    // TEMPORARY payload muna
    const path = "/v3/orders";
    const method = "POST";

    const payload = {
      data: {
        serviceType: "MOTORCYCLE",
        specialRequests: [],
        stops: [
          {
            coordinates: {
              lat: "14.5995",
              lng: "120.9842"
            },
            address: "Your Pickup Address"
          },
          {
            coordinates: {
              lat: "14.6760",
              lng: "121.0437"
            },
            address: `${savedAddress.fullAddress}, ${savedAddress.city}`
          }
        ]
      }
    };

    const body = JSON.stringify(payload);

    const { time, signature } =
      generateLalamoveSignature(method, path, body);

    const response = await axios.post(
      `${process.env.LALAMOVE_BASE_URL}${path}`,
      body,
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Authorization: `hmac ${process.env.LALAMOVE_API_KEY}:${time}:${signature}`,
          Market: process.env.LALAMOVE_MARKET || "PH",
          "Request-ID": `drin-book-${Date.now()}`
        }
      }
    );

    orders[index].courier = "Lalamove";
    orders[index].shipping_status = "BOOKED";
    orders[index].lalamove_booking = response.data;
    orders[index].updated_at = new Date().toISOString();

    await saveOrders(orders);

    res.json({
      success: true,
      booking: response.data
    });

  } catch (err) {
    console.error("LALAMOVE BOOK ERROR:", err.response?.data || err.message);

    res.status(500).json({
      success: false,
      message: "Lalamove booking failed",
      error: err.response?.data || err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});