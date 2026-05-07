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

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const ORDERS_FILE = path.join(__dirname, "data", "orders.json");

function ensureOrdersFile() {
  const dir = path.dirname(ORDERS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, "[]");
}

function readOrders() {
  ensureOrdersFile();
  try {
    return JSON.parse(fs.readFileSync(ORDERS_FILE, "utf8") || "[]");
  } catch {
    return [];
  }
}

function saveOrders(orders) {
  ensureOrdersFile();
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

function savePendingOrder({
  orderId,
  amount,
  subtotal,
  shippingFee,
  customerName,
  customerPhone,
  items,
  paymentProvider,
  checkoutUrl,
  address,
  parcelInfo,
  courier
}) {
  let orders = readOrders();

  const orderData = {
    external_id: orderId,
    amount: Number(amount),
    subtotal: Number(subtotal || amount || 0),
    shipping_fee: Number(shippingFee || 0),
    customer_name: customerName || "Customer",
    customer_phone: customerPhone || "",
    address: address || {},
    parcel_info: parcelInfo || {},
    items: Array.isArray(items) ? items : [],
    payment_provider: paymentProvider,
    courier: courier || "",
    checkout_url: checkoutUrl || "",
    status: "Pending Payment",
    order_status: "Processing",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const existingIndex = orders.findIndex(order => order.external_id === orderId);

  if (existingIndex !== -1) {
    orders[existingIndex] = {
      ...orders[existingIndex],
      ...orderData
    };
  } else {
    orders.push(orderData);
  }

  saveOrders(orders);
  return orderData;
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
    const { amount, paymentMethod, address, parcelInfo, voucherCode } = req.body;

    const result = await checkShippingFee({
      amount,
      paymentMethod,
      address,
      parcelInfo,
      voucherCode
    });

    if (result.ret_code !== 0) {
      return res.status(400).json({
        success: false,
        message: result.message || "SPX shipping fee check failed",
        spx: result
      });
    }

    const orderFee = result.data?.orders?.[0];
    const fail = result.data?.fail_list?.[0];

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

    let orders = readOrders();
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
      address: savedAddress.fullAddress || "Test address",

      deliverState: savedAddress.province || "Metro Manila",
      deliverCity: savedAddress.city || "Metro Manila",
      deliverDistrict: savedAddress.barangay || "Intramuros",
      deliverStreet: savedAddress.barangay || "Barangay 654",
      deliverPostCode: savedAddress.postCode || "1002",

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

    if (result.data?.success_count < 1) {
      orders[index].spx_batch_no = batchNo;
      orders[index].shipping_status = "SPX_FAILED";
      orders[index].spx_error = result.data?.fail_list?.[0]?.message || "SPX failed";
      orders[index].updated_at = new Date().toISOString();

      saveOrders(orders);

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

    saveOrders(orders);

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
app.post("/api/orders/cod", (req, res) => {
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
      parcelInfo,
      courier
    } = req.body;

    const order = savePendingOrder({
      orderId,
      amount,
      subtotal,
      shippingFee,
      customerName,
      customerPhone,
      items,
      paymentProvider: "COD",
      checkoutUrl: "",
      address,
      parcelInfo,
      courier
    });

    let orders = readOrders();
    const index = orders.findIndex(item => item.external_id === orderId);

    if (index !== -1) {
      orders[index].status = "COD";
      orders[index].order_status = "To Ship";
      orders[index].updated_at = new Date().toISOString();
      saveOrders(orders);
    }

    res.json({ success: true, order: index !== -1 ? orders[index] : order });
  } catch (err) {
    console.error("COD ORDER SAVE ERROR:", err);
    res.status(500).json({ success: false, message: "COD order save failed" });
  }
});

// ================= XENDIT =================
app.post("/api/create-payment", async (req, res) => {
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
        success_redirect_url: "https://drinelectronicsph.com/Home/index.html",
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

    const order = savePendingOrder({
      orderId,
      amount,
      customerName,
      customerPhone,
      items,
      paymentProvider: "XENDIT",
      address,
      parcelInfo,
      subtotal,
      shippingFee,
      checkoutUrl: data.invoice_url
    });

    res.json({
      success: true,
      checkoutUrl: data.invoice_url,
      order
    });
  } catch (err) {
    console.error("XENDIT ERROR:", err);
    res.status(500).json({ success: false, message: "Xendit failed" });
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
      }
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

    const order = savePendingOrder({
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

// ================= VIEW ORDERS =================
app.get("/api/orders", (req, res) => {
  const orders = readOrders();
  res.json({ success: true, orders });
});

// ================= UPDATE ORDER =================
app.post("/api/orders/update", (req, res) => {
  try {
    const { orderId, order_status, tracking_number, courier } = req.body;

    let orders = readOrders();
    const index = orders.findIndex(
      order => String(order.external_id) === String(orderId)
    );

    if (index === -1) {
      return res.json({
        success: false,
        message: "Order not found"
      });
    }

    if (order_status) orders[index].order_status = order_status;
    if (tracking_number !== undefined) orders[index].tracking_number = tracking_number;
    if (courier !== undefined) orders[index].courier = courier;

    orders[index].updated_at = new Date().toISOString();

    saveOrders(orders);

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

// ================= MAYA WEBHOOK =================
app.post("/webhook", (req, res) => {
  try {
    const data = req.body;

    console.log("MAYA WEBHOOK RECEIVED:", data);

    const orderId = data.requestReferenceNumber;
    const status = data.status;
    const isPaid = data.isPaid === true;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Missing requestReferenceNumber"
      });
    }

    let orders = readOrders();
    const index = orders.findIndex(order => order.external_id === orderId);

    if (index === -1) {
      console.log("Order not found:", orderId);
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    if (isPaid && status === "PAYMENT_SUCCESS") {
      orders[index].status = "PAID";
      orders[index].maya_status = "PAYMENT_SUCCESS";
      orders[index].paid_at = new Date().toISOString();
      orders[index].order_status = "Processing";
    } else {
      orders[index].maya_status = status || "UNKNOWN";
    }

    orders[index].maya_webhook_id = data.id || "";
    orders[index].maya_transaction_id = data.receipt?.transactionId || "";
    orders[index].maya_receipt_number = data.receiptNumber || data.receipt?.receiptNo || "";
    orders[index].updated_at = new Date().toISOString();

    saveOrders(orders);

    res.json({
      webhookDataProcessed: "success"
    });

  } catch (err) {
    console.error("MAYA WEBHOOK ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Webhook failed"
    });
  }
});

// ================= XENDIT/MAYA FALLBACK WEBHOOK =================
app.post("/api/xendit/webhook", (req, res) => {
  req.url = "/webhook";
  app._router.handle(req, res);
});

// ================= SPX ADDRESS FILE DOWNLOAD =================
app.get("/api/spx/address-file", async (req, res) => {
  try {
    const result = await spxPost("/open/api/address/get_address_download_url", {});
    const fileUrl = result?.data?.address_download_url;

    if (!fileUrl) {
      return res.status(400).json({
        success: false,
        message: "No address file URL returned"
      });
    }

    const response = await axios({
      method: "GET",
      url: fileUrl,
      responseType: "stream"
    });

    const savePath = path.join(__dirname, "data", "spx-address.xlsx");
    const writer = fs.createWriteStream(savePath);

    response.data.pipe(writer);

    writer.on("finish", () => {
      return res.json({
        success: true,
        message: "SPX address file downloaded",
        path: savePath
      });
    });

    writer.on("error", (streamErr) => {
      console.error("SPX ADDRESS FILE WRITE ERROR:", streamErr.message);

      if (!res.headersSent) {
        return res.status(500).json({
          success: false,
          message: "SPX address file save failed",
          error: streamErr.message
        });
      }
    });
  } catch (err) {
    console.error(
      "SPX ADDRESS FILE ERROR:",
      err.response?.status,
      err.response?.statusText || err.message
    );

    return res.status(500).json({
      success: false,
      message: "SPX address file download failed",
      status: err.response?.status || null,
      statusText: err.response?.statusText || null,
      error: err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
