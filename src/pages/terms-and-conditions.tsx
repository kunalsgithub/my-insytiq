import React from 'react';

const TermsAndConditions = () => (
  <div className="max-w-3xl mx-auto py-12 px-4 bg-white rounded-2xl shadow-md">
    <h1 className="text-4xl font-extrabold mb-2 gradient-text">Terms & Conditions</h1>
    <p className="text-sm text-muted-foreground mb-8">Effective Date: <span className="font-semibold">27/June/2025</span></p>
    <p className="mb-6 text-lg">Welcome to <span className="font-semibold">insytiq.ai</span> (“we,” “our,” or “us”). These Terms & Conditions (“Terms”) govern your access to and use of our website and services located at <span className='text-insta-primary font-semibold'>insytiq.ai</span> (the “Platform”).</p>
    <p className="mb-6 text-base">By using our platform, you agree to be bound by these Terms. If you do not agree, do not use our services.</p>

    <h2 className="text-2xl font-bold mt-10 mb-2">1. Eligibility</h2>
    <p className="mb-6">You must be at least 13 years old to use this service. By using our services, you represent that you meet this age requirement.</p>

    <h2 className="text-2xl font-bold mt-10 mb-2">2. Account Registration</h2>
    <ul className="list-disc list-inside mb-6 text-base space-y-1">
      <li>Provide accurate, complete, and current information.</li>
      <li>Keep your login credentials secure.</li>
      <li>Be responsible for all activities under your account.</li>
    </ul>

    <h2 className="text-2xl font-bold mt-10 mb-2">3. Subscription & Payments</h2>
    <ul className="list-disc list-inside mb-6 text-base space-y-1">
      <li>We offer both free and paid subscription plans. By subscribing to a paid plan:</li>
      <li>You authorize us or our payment processor (e.g., Paddle, Stripe) to charge your payment method.</li>
      <li>Subscription fees are billed in advance and are non-refundable.</li>
      <li>Your subscription will auto-renew unless cancelled before the renewal date.</li>
    </ul>

    <h2 className="text-2xl font-bold mt-10 mb-2">4. Use of the Platform</h2>
    <ul className="list-disc list-inside mb-6 text-base space-y-1">
      <li>You agree not to:</li>
      <li>Scrape, copy, or reverse engineer our services or content.</li>
      <li>Misuse our data or violate any Instagram or third-party terms.</li>
      <li>Use our services for illegal, misleading, or harmful purposes.</li>
    </ul>
    <p className="mb-6">We reserve the right to suspend or terminate your access if we suspect misuse.</p>

    <h2 className="text-2xl font-bold mt-10 mb-2">5. Intellectual Property</h2>
    <p className="mb-6">All content on the platform, including branding, design, data visualizations, and code, is our intellectual property or licensed to us.<br/>You are granted a limited, non-transferable, non-exclusive license to use the platform for personal or business use under your chosen plan.</p>

    <h2 className="text-2xl font-bold mt-10 mb-2">6. Third-Party Integrations</h2>
    <p className="mb-6">Our platform may use third-party APIs (e.g., SocialBlade, Instagram) to provide data. We are not responsible for inaccuracies or outages from those sources.</p>

    <h2 className="text-2xl font-bold mt-10 mb-2">7. Limitation of Liability</h2>
    <ul className="list-disc list-inside mb-6 text-base space-y-1">
      <li>To the fullest extent permitted by law, we are not liable for:</li>
      <li>Indirect or consequential damages.</li>
      <li>Any data loss or loss of business profits.</li>
      <li>Errors or interruptions in service.</li>
    </ul>
    <p className="mb-6">Use the platform at your own risk.</p>

    <h2 className="text-2xl font-bold mt-10 mb-2">8. Cancellation & Termination</h2>
    <ul className="list-disc list-inside mb-6 text-base space-y-1">
      <li>You may cancel your subscription at any time. Upon cancellation:</li>
      <li>Your account will remain active until the end of the current billing period.</li>
      <li>No refunds will be issued for partial usage.</li>
      <li>We may terminate your account without notice if you violate these Terms.</li>
    </ul>

    <h2 className="text-2xl font-bold mt-10 mb-2">9. Changes to the Terms</h2>
    <p className="mb-6">We may update these Terms at any time. We will notify you of significant changes via email or notice on the platform. Your continued use of the service means you accept the changes.</p>

    <h2 className="text-2xl font-bold mt-10 mb-2">10. Contact Us</h2>
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

export default TermsAndConditions; 