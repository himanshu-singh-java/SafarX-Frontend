import { getAuthToken, getAuthHeaders, handleAuthResponse } from './auth';

/**
 * SafarX Razorpay Payment Gateway Client
 * Integrates Razorpay Standard Checkout with Spring Boot backend APIs:
 * - POST /api/payment/create-order (Protected with JWT)
 * - POST /api/payment/verify (Protected with JWT)
 */

export const RAZORPAY_KEY_ID =
  import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_Tqcd3XSrs9GLmI';

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

  const scriptLoaded = await loadRazorpayScript();
  if (!scriptLoaded || !window.Razorpay) {
    if (onError) {
      onError(
        new Error(
          'Unable to load Razorpay payment SDK. Please verify your internet connection.'
        )
      );
    }
    return;
  }

  // 1. Create Razorpay Order in Backend with JWT Auth
  let orderData = null;
  try {
    const response = await fetch('http://localhost:8080/api/payment/create-order', {
      method: 'POST',
      headers: getAuthHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({
        rideId: Number(rideId),
      }),
    });

    if (handleAuthResponse(response)) {
      if (onError) onError(new Error('Session expired. Please log in again.'));
      return;
    }

    if (!response.ok) {
      let errJson = {};
      try {
        errJson = await response.json();
      } catch {
        const text = await response.text().catch(() => '');
        errJson = { message: text };
      }
      throw new Error(errJson.message || `Failed to create payment order (${response.status})`);
    }

    const raw = await response.json();
    orderData = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (err) {
    console.error('Order creation error:', err);
    if (onError) {
      onError(new Error(err.message || 'Error connecting to payment gateway.'));
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
      name: userName || localStorage.getItem('userName') || 'SafarX Rider',
      email: userEmail || localStorage.getItem('userEmail') || 'rider@safarx.in',
      contact: userPhone || localStorage.getItem('userPhone') || '7321948274',
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
      // 3. Cryptographic Signature Verification in Backend
      try {
        const verifyRes = await fetch('http://localhost:8080/api/payment/verify', {
          method: 'POST',
          headers: getAuthHeaders({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            rideId: Number(rideId),
            razorPayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignatureId: response.razorpay_signature,
          }),
        });

        if (handleAuthResponse(verifyRes)) {
          if (onError) onError(new Error('Session expired during verification.'));
          return;
        }

        if (verifyRes.ok) {
          const result = await verifyRes.json().catch(() => ({ status: 'success' }));
          if (onSuccess) {
            onSuccess({
              ...result,
              paymentId: response.razorpay_payment_id,
              orderId: response.razorpay_order_id,
              amount: parseFloat(Number(amount).toFixed(2)),
            });
          }
        } else {
          let errJson = {};
          try {
            errJson = await verifyRes.json();
          } catch {
            const errText = await verifyRes.text().catch(() => '');
            errJson = { message: errText };
          }
          throw new Error(errJson.message || 'Signature verification failed on backend.');
        }
      } catch (verifyErr) {
        console.error('Payment verification error:', verifyErr);
        if (onError) {
          onError(
            new Error(
              verifyErr.message ||
                'Payment signature verification failed. Please contact support.'
            )
          );
        }
      }
    },
  };

  try {
    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', function (resp) {
      console.warn('Payment failed response:', resp);
      if (onError) {
        onError(new Error(resp.error?.description || 'Payment was declined or cancelled.'));
      }
    });
    rzp.open();
  } catch (openErr) {
    console.error('Failed to open Razorpay modal:', openErr);
    if (onError) onError(openErr);
  }
}

export default {
  RAZORPAY_KEY_ID,
  loadRazorpayScript,
  initiateRazorpayPayment,
};

