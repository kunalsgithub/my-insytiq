import React from 'react';

const Refund = () => (
  <div className="max-w-3xl mx-auto py-12 px-4 bg-white rounded-2xl shadow-md">
    <h1 className="text-4xl font-extrabold mb-2 gradient-text">Refund Policy</h1>
    <p className="text-sm text-muted-foreground mb-8">Effective Date: <span className="font-semibold">27/June/2025</span></p>
    <p className="mb-6 text-lg">Thank you for subscribing to <span className="font-semibold">insytiq.ai</span>. We are committed to delivering value through our trend and influencer analytics tools. However, due to the nature of digital products and data-based services, we have the following refund policy in place:</p>

    <h2 className="text-2xl font-bold mt-10 mb-2">1. Subscription Plans (Free & Paid)</h2>
    <p className="mb-6">Our platform offers both free and paid subscription plans.<br/>When you choose a paid plan, you get immediate access to premium data, insights, and analytics tools.</p>

    <h2 className="text-2xl font-bold mt-10 mb-2">2. No Refunds on Paid Subscriptions</h2>
    <ul className="list-disc list-inside mb-6 text-base space-y-1">
      <li>All payments made for subscription plans (monthly or annually) are non-refundable, including:</li>
      <li>Partial use of the service during the billing period.</li>
      <li>Downgrades after payment.</li>
      <li>Change of mind or accidental purchase.</li>
      <li>Once a payment is processed, we do not issue refunds, regardless of usage.</li>
    </ul>

    <h2 className="text-2xl font-bold mt-10 mb-2">3. Auto-Renewals and Cancellations</h2>
    <ul className="list-disc list-inside mb-6 text-base space-y-1">
      <li>Your subscription will automatically renew at the end of each billing cycle unless cancelled in advance.</li>
      <li>You can cancel your plan at any time from your account dashboard. After cancellation, you'll still have access to the service until your billing period ends.</li>
      <li>It is your responsibility to cancel your subscription before the renewal date to avoid charges.</li>
    </ul>

    <h2 className="text-2xl font-bold mt-10 mb-2">4. Exceptions (If Applicable)</h2>
    <ul className="list-disc list-inside mb-6 text-base space-y-1">
      <li>Refunds may be considered in the following rare cases:</li>
      <li>If the platform experiences extended downtime (over 72 consecutive hours).</li>
      <li>If your account was charged due to a technical error on our side.</li>
      <li>For any such exception, you must contact us at <a href="mailto:contact@insytiq.ai" className="text-insta-primary underline font-semibold">contact@insytiq.ai</a> within 7 days of the billing date.</li>
    </ul>

    <h2 className="text-2xl font-bold mt-10 mb-2">5. Disputed Charges</h2>
    <p className="mb-6">If you notice an unrecognized charge, please contact us before disputing it with your payment provider. We're here to resolve issues quickly.</p>

    <h2 className="text-2xl font-bold mt-10 mb-2">6. How to Contact Us</h2>
    <div className="mb-2 flex items-center gap-2">
      <span role="img" aria-label="email">📧</span>
      <a href="mailto:contact@insytiq.ai" className="text-insta-primary underline font-semibold">contact@insytiq.ai</a>
    </div>
    <div className="mb-2 flex items-center gap-2">
      <span role="img" aria-label="web">🌐</span>
      <a href="https://insytiq.ai" className="text-insta-primary underline font-semibold">insytiq.ai</a>
    </div>
  </div>
);

export default Refund; 