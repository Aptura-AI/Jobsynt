'use client';

import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';

const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

export default function PayPalButton() {
  // Safety guardrail: If client ID is missing, show user-safe message
  if (!PAYPAL_CLIENT_ID) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
        <p className="text-gray-600">Payments are temporarily unavailable</p>
      </div>
    );
  }

  return (
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
                  value: '29.00',
                },
                description: 'JobSynt Candidate Access',
              },
            ],
          });
        }}
        onApprove={(data, actions) => {
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
          });
        }}
        onError={(err) => {
          console.error('PayPal payment error:', err);
        }}
        onCancel={(data) => {
          console.log('Payment cancelled:', data);
        }}
      />
    </PayPalScriptProvider>
  );
}

