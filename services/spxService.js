const axios = require("axios");
const crypto = require("crypto");

const BASE_URL = process.env.SPX_API_BASE_URL;

function generateCheckSign(appId, appSecret, timestamp, randomNum, payloadString) {
  const raw = `${appId}_${timestamp}_${randomNum}_${payloadString}`;

  return crypto
    .createHmac("sha256", appSecret)
    .update(raw)
    .digest("hex");
}

async function spxPost(endpoint, payload) {
  const appId = process.env.SPX_APP_ID;
  const appSecret = process.env.SPX_APP_SECRET;

  const timestamp = Math.floor(Date.now() / 1000);
  const randomNum = Math.floor(Math.random() * 1000000000);

  const payloadString = JSON.stringify(payload);

  const checkSign = generateCheckSign(
    appId,
    appSecret,
    timestamp,
    randomNum,
    payloadString
  );

  try {

    const response = await axios.post(
      `${BASE_URL}${endpoint}`,
      payloadString,
      {
        headers: {
          "app-id": appId,
          "check-sign": checkSign,
          timestamp,
          "random-num": randomNum,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("SPX RESPONSE:", response.data);

    return response.data;

  } catch (error) {

    console.log(
      "SPX FULL ERROR:",
      error.response?.data || error.message
    );

    throw error;
  }
}

async function verifyAccount() {
  return spxPost("/open/api/v1/account/verify", {
    user_id: Number(process.env.SPX_USER_ID),
    user_secret: process.env.SPX_USER_SECRET
  });
}

function normalizeParcelInfo(parcelInfo = {}) {
  return {
    parcel_weight: Number(parcelInfo.parcelWeight || parcelInfo.parcel_weight || 1),
    parcel_length: Number(parcelInfo.parcelLength || parcelInfo.parcel_length || 10),
    parcel_width: Number(parcelInfo.parcelWidth || parcelInfo.parcel_width || 10),
    parcel_height: Number(parcelInfo.parcelHeight || parcelInfo.parcel_height || 10),
    parcel_item_name: parcelInfo.itemName || parcelInfo.parcel_item_name || "Electronics",
    parcel_item_quantity: Number(parcelInfo.itemQuantity || parcelInfo.parcel_item_quantity || 1),
    express_insured_value: Number(parcelInfo.expressInsuredValue || parcelInfo.express_insured_value || 0),
    parcel_item_type: parcelInfo.itemType || parcelInfo.parcel_item_type || "Electronics"
  };
}

function normalizeAddress(address = {}) {
  return {
    deliver_state: address.province || address.deliverState || "Metro Manila",
    deliver_city: address.city || address.deliverCity || "Metro Manila",
    deliver_district: address.barangay || address.deliverDistrict || "Intramuros",
    deliver_street: address.barangay || address.deliverStreet || "Barangay 654",
    deliver_post_code: address.postCode || address.deliverPostCode || "1002",
    deliver_detail_address: address.fullAddress || address.deliverDetailAddress || "Test address"
  };
}

async function checkShippingFee({ amount, paymentMethod, address, parcelInfo, voucherCode }) {
  const parcel = normalizeParcelInfo({
    ...parcelInfo,
    expressInsuredValue: Number(amount || 0)
  });
  const delivery = normalizeAddress(address);

  return spxPost("/open/api/v1/order/batch_check_order", {
    user_id: Number(process.env.SPX_USER_ID),
    user_secret: process.env.SPX_USER_SECRET,
    orders: [
      {
        order_id: `QUOTE-${Date.now()}`,
        base_info: {
          service_type: 1
        },
        sender_info: {
          sender_state: process.env.SPX_SENDER_STATE || "Metro Manila",
          sender_city: process.env.SPX_SENDER_CITY || "Metro Manila",
          sender_district: process.env.SPX_SENDER_DISTRICT || "Binondo",
          sender_street: process.env.SPX_SENDER_STREET || "Barangay 287",
          sender_post_code: process.env.SPX_SENDER_POST_CODE || "1006",
          sender_detail_address: process.env.SPX_SENDER_ADDRESS || "Drin Electronics Warehouse"
        },
        fulfillment_info: {
          cod_collection: paymentMethod === "COD" ? 1 : 0,
          cod_amount: paymentMethod === "COD" ? Number(amount || 0) : 0,
          collect_type: Number(process.env.SPX_COLLECT_TYPE || 2),
          ...(voucherCode ? { voucher_code: voucherCode } : {})
        },
        deliver_info: {
          ...delivery,
          deliver_name: "Test Customer",
          deliver_phone: "09171234567"
        },

        parcel_info: {
          parcel_weight: 1,
          parcel_length: 10,
          parcel_width: 10,
          parcel_height: 20,
          parcel_item_name: "Electronics",
          parcel_item_quantity: 1,
          express_insured_value: Number(amount || 0),
          parcel_item_type: "Electronics"
        }
      }
    ]
  });
}

async function createOrder(order) {
  return spxPost("/open/api/v2/order/batch_create_order", {
    user_id: Number(process.env.SPX_USER_ID),
    user_secret: process.env.SPX_USER_SECRET,
    orders: [
      {
        order_id: order._id.toString(),

        base_info: {
          service_type: 1
        },

        sender_info: {
          sender_state: process.env.SPX_SENDER_STATE || "Metro Manila",
          sender_city: process.env.SPX_SENDER_CITY || "Metro Manila",
          sender_district: process.env.SPX_SENDER_DISTRICT || "Binondo",
          sender_street: process.env.SPX_SENDER_STREET || "Barangay 287",
          sender_post_code: process.env.SPX_SENDER_POST_CODE || "1006",
          sender_name: process.env.SPX_SENDER_NAME || "Drin Electronics",
          sender_phone: process.env.SPX_SENDER_PHONE || "639123456789",
          sender_detail_address: process.env.SPX_SENDER_ADDRESS || "Drin Electronics Warehouse"
        },

        fulfillment_info: {
          payment_role: 1,
          cod_collection: order.paymentMethod === "COD" ? 1 : 0,
          cod_amount: order.paymentMethod === "COD" ? Number(order.totalAmount) : 0,
          collect_type: 2
        },

        deliver_info: {
          deliver_state: order.deliverState,
          deliver_city: order.deliverCity,
          deliver_district: order.deliverDistrict,
          deliver_street: order.deliverStreet,
          deliver_post_code: order.deliverPostCode,
          deliver_name: order.customerName,
          deliver_phone: order.phone,
          deliver_detail_address: order.address,
          deliver_instruction: order.note || ""
        },

        parcel_info: {
          parcel_weight: order.parcelWeight || 1,
          parcel_length: order.parcelLength || 10,
          parcel_width: order.parcelWidth || 10,
          parcel_height: order.parcelHeight || 10,
          parcel_item_name: order.parcelItemName || "Electronics",
          parcel_item_quantity: order.parcelItemQuantity || order.items?.length || 1,
          express_insured_value: Number(order.totalAmount),
          parcel_item_type: order.parcelItemType || "Electronics"
        }
      }
    ]
  });
}

async function getCreateResult(batchNo) {
  return spxPost("/open/api/v2/order/get_order_create_result", {
    user_id: Number(process.env.SPX_USER_ID),
    user_secret: process.env.SPX_USER_SECRET,
    batch_no: Number(batchNo)
  });
}

async function getAWB(batchNo) {
  return spxPost("/open/api/v2/order/batch_get_shipping_label", {
    user_id: Number(process.env.SPX_USER_ID),
    user_secret: process.env.SPX_USER_SECRET,
    batch_no: Number(batchNo)
  });
}

module.exports = {
  spxPost,
  verifyAccount,
  checkShippingFee,
  createOrder,
  getCreateResult,
  getAWB
};