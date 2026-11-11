import apiClient from './apiClient';
import { RAZORPAY_KEY_ID } from '../config';
import { getAuthToken } from './auth';

/**
 * SafarX Razorpay Payment Gateway Client
 * Integrates Razorpay Standard Checkout with Spring Boot backend APIs:
 * - POST /api/payment/create-order (Protected with JWT)
 * - POST /api/payment/verify (Protected with JWT)
 */

export { RAZORPAY_KEY_ID };

/**
 * Ensures the Razorpay checkout.js script is loaded on the page
 */
export function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.error('Failed to load Razorpay Checkout script.');
      resolve(false);
    };
    document.body.appendChild(script);
  });
}

/**
 * Initiate Razorpay Checkout Flow
 *
 * @param {Object} params
 * @param {number} params.amount - Total fare amount in INR (e.g. 206.60)
 * @param {number|string} params.rideId - Trip identifier
 * @param {string} [params.userEmail] - Rider email for prefill
 * @param {string} [params.userName] - Rider name for prefill
 * @param {string} [params.userPhone] - Rider phone for prefill
 * @param {function} params.onSuccess - Callback on verified payment
 * @param {function} params.onError - Callback on payment error
 * @param {function} [params.onDismiss] - Callback when user closes Razorpay modal
 */
export async function initiateRazorpayPayment({
  amount,
  rideId,
  userEmail,
  userName,
  userPhone,
  onSuccess,
  onError,
  onDismiss,
}) {
  const token = getAuthToken();
  if (!token) {
    if (onError) {
      onError(new Error('Authentication token missing. Please sign in to pay.'));
    }
    return;
  }

  if (!RAZORPAY_KEY_ID) {
    if (onError) {
      onError(new Error('Payment gateway key missing. Please set VITE_RAZORPAY_KEY_ID in your environment.'));
    }
    return;
  }

  const scriptLoaded = await loadRazorpayScript();
  if (!scriptLoaded || !window.Razorpay) {
    if (onError) {
      onError(
        new Error(
          'Unable to load payment SDK. Please verify your internet connection and try again.'
        )
      );
    }
    return;
  }

  // 1. Create Razorpay Order in Backend with JWT Auth via apiClient
  let orderData = null;
  try {
    const res = await apiClient.post('/api/payment/create-order', {
      rideId: Number(rideId),
    });

    const raw = res.data;
    orderData = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (err) {
    console.error('Order creation error:', err);
    if (onError) {
      const msg = err.response?.data?.message || err.message || 'Error connecting to payment gateway.';
      onError(new Error(msg));
    }
    return;
  }

  if (!orderData || !orderData.id) {
    if (onError) {
      onError(new Error('Invalid order response returned from server.'));
    }
    return;
  }

  // 2. Open Razorpay Standard Checkout Popup
  const options = {
    key: RAZORPAY_KEY_ID,
    amount: orderData.amount, // in paise
    currency: orderData.currency || 'INR',
    name: 'SafarX Technologies',
    description: `Ride Settlement #${rideId || 'Trip'} • Instant Checkout`,
    image: '/vehicle_car.jpg',
    order_id: orderData.id,
    prefill: {
      name: userName || localStorage.getItem('userName') || '',
      email: userEmail || localStorage.getItem('userEmail') || '',
      contact: userPhone || localStorage.getItem('userPhone') || '',
    },
    notes: {
      ride_id: String(rideId),
      platform: 'SafarX Web',
    },
    theme: {
      color: '#10b981', // SafarX emerald green brand accent
    },
    modal: {
      ondismiss: () => {
        if (onDismiss) onDismiss();
      },
    },
    handler: async function (response) {
      // 3. Cryptographic Signature Verification in Backend via apiClient
      try {
        const verifyRes = await apiClient.post('/api/payment/verify', {
          rideId: Number(rideId),
          razorPayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignatureId: response.razorpay_signature,
        });

        const result = verifyRes.data || { status: 'success' };
        if (onSuccess) {
          onSuccess({
            ...result,
            paymentId: response.razorpay_payment_id,
            orderId: response.razorpay_order_id,
          });
        }
      } catch (err) {
        console.error('Payment signature verification failed:', err);
        if (onError) {
          const msg = err.response?.data?.message || 'Payment verification failed. Please contact support.';
          onError(new Error(msg));
        }
      }
    },
  };

  try {
    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', function (resp) {
      console.warn('Payment failed callback:', resp.error);
      if (onError) {
        onError(
          new Error(
            resp.error?.description ||
              'Payment was declined or cancelled by bank. Please try another method.'
          )
        );
      }
    });
    rzp.open();
  } catch (initErr) {
    console.error('Razorpay popup open error:', initErr);
    if (onError) {
      onError(new Error('Failed to open payment modal.'));
    }
  }
}
