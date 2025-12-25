'use client';

import { useState } from 'react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';

const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
const BASE_PRICE = 29.00;

export default function PayPalButton() {
  const [couponCode, setCouponCode] = useState('');
  const [discountInfo, setDiscountInfo] = useState<{ percent: number; finalPrice: number } | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Safety guardrail: If client ID is missing, show user-safe message
  if (!PAYPAL_CLIENT_ID) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
        <p className="text-gray-600">Payments are temporarily unavailable</p>
      </div>
    );
  }

  const validateCoupon = async (code: string) => {
    if (!code.trim()) {
      setDiscountInfo(null);
      setValidationError(null);
      return;
    }

    setValidating(true);
    setValidationError(null);

    try {
      const res = await fetch('/api/payments/validate-coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim().toUpperCase() }),
      });

      const data = await res.json();

      if (!res.ok || !data.valid) {
        setDiscountInfo(null);
        setValidationError(data.error || 'Invalid coupon code');
      } else {
        const discountPercent = data.discount_percent || 0;
        const finalPrice = BASE_PRICE * (1 - discountPercent / 100);
        setDiscountInfo({ percent: discountPercent, finalPrice });
        setValidationError(null);
      }
    } catch (err) {
      setDiscountInfo(null);
      setValidationError('Error validating coupon code');
    } finally {
      setValidating(false);
    }
  };

  const handleCouponChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const code = e.target.value.toUpperCase();
    setCouponCode(code);
    validateCoupon(code);
  };

  const finalPrice = discountInfo ? discountInfo.finalPrice : BASE_PRICE;

  return (
    <div>
      {/* Coupon Code Input */}
      <div className="mb-4">
        <label htmlFor="coupon-code" className="block text-sm font-medium text-gray-700 mb-2">
          Coupon Code (Optional)
        </label>
        <div className="flex gap-2">
          <input
            id="coupon-code"
            type="text"
            value={couponCode}
            onChange={handleCouponChange}
            placeholder="Enter code"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            disabled={validating}
          />
          {validating && (
            <div className="flex items-center px-3">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-primary"></div>
            </div>
          )}
        </div>
        {validationError && (
          <p className="mt-1 text-xs text-red-600">{validationError}</p>
        )}
        {discountInfo && !validationError && (
          <p className="mt-1 text-xs text-green-600">
            {discountInfo.percent}% discount applied! Final price: ${discountInfo.finalPrice.toFixed(2)}
          </p>
        )}
      </div>

      <PayPalScriptProvider options={{ clientId: PAYPAL_CLIENT_ID }}>
        <PayPalButtons
          style={{
            layout: 'vertical',
            color: 'blue',
            shape: 'rect',
            label: 'paypal',
          }}
          createOrder={(data, actions) => {
            return actions.order.create({
              intent: 'CAPTURE',
              purchase_units: [
                {
                  amount: {
                    currency_code: 'USD',
                    value: finalPrice.toFixed(2),
                  },
                  description: 'JobSynt Candidate Access',
                },
              ],
            });
          }}
        onApprove={(data, actions): Promise<void> => {
          if (!actions.order) {
            return Promise.resolve();
          }
          
          return actions.order.capture().then(async (details) => {
            // Log payment confirmation to console
            console.log('Payment successful:', {
              orderId: details.id,
              payerEmail: details.payer?.email_address,
              amount: details.purchase_units?.[0]?.amount?.value,
              currency: details.purchase_units?.[0]?.amount?.currency_code,
              status: details.status,
              payerName: details.payer?.name?.given_name + ' ' + details.payer?.name?.surname,
            });
            
            // Log payment to database (non-blocking)
            try {
              const response = await fetch('/api/payments/paypal-success', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  orderId: details.id,
                  payerEmail: details.payer?.email_address || null,
                  amount: details.purchase_units?.[0]?.amount?.value,
                  currency: details.purchase_units?.[0]?.amount?.currency_code,
                  raw: details, // Full capture response
                  couponCode: couponCode.trim() || null, // Pass coupon code if provided
                }),
              });

              if (!response.ok) {
                console.error('Failed to log payment to database:', await response.text());
              } else {
                console.log('Payment logged to database successfully');
              }
            } catch (error) {
              // Log error but do NOT block UX
              console.error('Error logging payment to database:', error);
            }
            
            // Do not modify candidate state yet (intentional for MVP safety)
            // Do not grant access automatically
            return;
          }) as Promise<void>;
        }}
        onError={(err) => {
          console.error('PayPal payment error:', err);
        }}
        onCancel={(data) => {
          console.log('Payment cancelled:', data);
        }}
      />
      </PayPalScriptProvider>
    </div>
  );
}

