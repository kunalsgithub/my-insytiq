import React from 'react';

const Privacy = () => (
  <div className="max-w-3xl mx-auto py-12 px-4 bg-white rounded-2xl shadow-md">
    <h1 className="text-4xl font-extrabold mb-2 gradient-text">Privacy Policy</h1>
    <p className="text-sm text-muted-foreground mb-8">Effective Date: <span className="font-semibold">27/June/2025</span></p>
    <p className="mb-6 text-lg">Welcome to <span className="font-semibold">Who is Trend</span> (“we,” “our,” or “us”). We are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website <span className="text-insta-primary font-semibold">whoistrend.com</span>, use our analytics platform, or subscribe to our services.</p>

    <h2 className="text-2xl font-bold mt-10 mb-2">1. Information We Collect</h2>
    <ul className="list-disc list-inside mb-6 text-base space-y-1">
      <li><span className="font-semibold">Personal Information:</span> Name, email address, payment details, social media usernames (e.g. Instagram handles) when you sign up or purchase a subscription.</li>
      <li><span className="font-semibold">Usage Data:</span> Pages visited, analytics accessed, features used, and interaction patterns.</li>
      <li><span className="font-semibold">Cookies & Tracking Technologies:</span> To enhance your experience and measure platform performance.</li>
    </ul>

    <h2 className="text-2xl font-bold mt-10 mb-2">2. How We Use Your Information</h2>
    <ul className="list-disc list-inside mb-6 text-base space-y-1">
      <li>Provide and improve our services and features.</li>
      <li>Process your subscription and payments securely.</li>
      <li>Communicate updates, product news, or promotional offers (you can opt out).</li>
      <li>Monitor usage trends and prevent abuse.</li>
    </ul>

    <h2 className="text-2xl font-bold mt-10 mb-2">3. Sharing Your Information</h2>
    <p className="mb-2">We do <span className="font-bold text-green-600">not sell</span> your personal data. We may share data with:</p>
    <ul className="list-disc list-inside mb-6 text-base space-y-1">
      <li>Payment Processors (e.g. Paddle, Stripe) for secure billing.</li>
      <li>Analytics Services to improve product performance.</li>
      <li>Legal authorities when required by law.</li>
    </ul>

    <h2 className="text-2xl font-bold mt-10 mb-2">4. Data Security</h2>
    <p className="mb-6">We implement industry-standard security measures to protect your data. However, no digital platform is 100% secure. You use our platform at your own risk.</p>

    <h2 className="text-2xl font-bold mt-10 mb-2">5. Third-Party Links</h2>
    <p className="mb-6">Our platform may contain links to third-party services (e.g. Instagram, SocialBlade). We are not responsible for their privacy practices. Please read their policies separately.</p>

    <h2 className="text-2xl font-bold mt-10 mb-2">6. Your Rights</h2>
    <ul className="list-disc list-inside mb-6 text-base space-y-1">
      <li>Access or correct your personal data.</li>
      <li>Delete your account and related data.</li>
      <li>Withdraw consent at any time.</li>
    </ul>
    <p className="mb-6">To make a request, email us at <a href="mailto:contact@whoistrend.com" className="text-insta-primary underline font-semibold">contact@whoistrend.com</a>.</p>

    <h2 className="text-2xl font-bold mt-10 mb-2">7. Children's Privacy</h2>
    <p className="mb-6">Our platform is not intended for users under the age of 13. We do not knowingly collect data from children.</p>

    <h2 className="text-2xl font-bold mt-10 mb-2">8. Changes to This Policy</h2>
    <p className="mb-6">We may update this Privacy Policy periodically. We'll notify users of significant changes via email or platform notice.</p>

    <h2 className="text-2xl font-bold mt-10 mb-2">9. Contact Us</h2>
    <div className="mb-2 flex items-center gap-2">
      <span role="img" aria-label="email">📧</span>
      <a href="mailto:contact@whoistrend.com" className="text-insta-primary underline font-semibold">contact@whoistrend.com</a>
    </div>
    <div className="mb-2 flex items-center gap-2">
      <span role="img" aria-label="web">🌐</span>
      <a href="www.whoistrend.com" className="text-insta-primary underline font-semibold">www.whoistrend.com</a>
    </div>
  </div>
);

export default Privacy; 