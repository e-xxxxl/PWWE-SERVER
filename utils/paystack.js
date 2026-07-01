const axios = require('axios');

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

// Create axios instance for Paystack
const paystackApi = axios.create({
  baseURL: PAYSTACK_BASE_URL,
  headers: {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json'
  }
});

/**
 * Initialize a Paystack transaction
 */
const initializeTransaction = async ({ email, amount, reference, metadata = {}, callback_url }) => {
  try {
    const response = await paystackApi.post('/transaction/initialize', {
      email,
      amount: amount * 100, // Convert to kobo
      reference,
      callback_url: callback_url || process.env.PAYSTACK_CALLBACK_URL,
      metadata
    });

    if (response.data.status) {
      return {
        success: true,
        data: response.data.data
      };
    } else {
      return {
        success: false,
        message: response.data.message
      };
    }
  } catch (error) {
    console.error('Paystack initialization error:', error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.message || error.message
    };
  }
};

/**
 * Verify a Paystack transaction
 */
const verifyTransaction = async (reference) => {
  try {
    const response = await paystackApi.get(`/transaction/verify/${reference}`);

    if (response.data.status) {
      return {
        success: true,
        data: response.data.data
      };
    } else {
      return {
        success: false,
        message: response.data.message
      };
    }
  } catch (error) {
    console.error('Paystack verification error:', error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.message || error.message
    };
  }
};

/**
 * List transactions
 */
const listTransactions = async (params = {}) => {
  try {
    const response = await paystackApi.get('/transaction', { params });
    
    if (response.data.status) {
      return {
        success: true,
        data: response.data.data
      };
    } else {
      return {
        success: false,
        message: response.data.message
      };
    }
  } catch (error) {
    console.error('Paystack list transactions error:', error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.message || error.message
    };
  }
};

/**
 * Get single transaction
 */
const getTransaction = async (id) => {
  try {
    const response = await paystackApi.get(`/transaction/${id}`);
    
    if (response.data.status) {
      return {
        success: true,
        data: response.data.data
      };
    } else {
      return {
        success: false,
        message: response.data.message
      };
    }
  } catch (error) {
    console.error('Paystack get transaction error:', error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.message || error.message
    };
  }
};

/**
 * Charge authorization (for recurring payments)
 */
const chargeAuthorization = async ({ email, amount, authorization_code, reference, metadata = {} }) => {
  try {
    const response = await paystackApi.post('/transaction/charge_authorization', {
      email,
      amount: amount * 100,
      authorization_code,
      reference,
      metadata
    });

    if (response.data.status) {
      return {
        success: true,
        data: response.data.data
      };
    } else {
      return {
        success: false,
        message: response.data.message
      };
    }
  } catch (error) {
    console.error('Paystack charge authorization error:', error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.message || error.message
    };
  }
};

/**
 * Check authorization (validate card/bank details)
 */
const checkAuthorization = async ({ email, amount, authorization_code }) => {
  try {
    const response = await paystackApi.post('/transaction/check_authorization', {
      email,
      amount: amount * 100,
      authorization_code
    });

    if (response.data.status) {
      return {
        success: true,
        data: response.data.data
      };
    } else {
      return {
        success: false,
        message: response.data.message
      };
    }
  } catch (error) {
    console.error('Paystack check authorization error:', error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.message || error.message
    };
  }
};

module.exports = {
  initializeTransaction,
  verifyTransaction,
  listTransactions,
  getTransaction,
  chargeAuthorization,
  checkAuthorization
};