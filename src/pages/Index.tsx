import React from "react";

const highlights = [
  {
    title: "Instagram Analytics",
    description: "Track your growth, engagement, and audience insights with beautiful charts.",
    icon: "📈",
  },
  {
    title: "Top Influencers",
    description: "Discover the most influential creators in every niche.",
    icon: "🌟",
  },
  {
    title: "Brand Collab Readiness",
    description: "See how ready your profile is for brand deals and partnerships.",
    icon: "🤝",
  },
  {
    title: "Daily Trend Explorer",
    description: "Stay ahead with real-time trending hashtags, posts, and audio.",
    icon: "🔥",
  },
];

const Index = () => {
  return (
    <div className="max-w-5xl mx-auto py-12 px-2 md:px-0">
      {/* Hero Section */}
      <section className="w-full py-16 px-4 flex flex-col items-center text-center bg-gradient-to-br from-[#f9ce34]/10 via-[#ee2a7b]/10 to-[#6228d7]/10 rounded-2xl mb-12">
        <h1 className="text-4xl md:text-5xl font-extrabold mb-4 bg-gradient-to-r from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] bg-clip-text text-transparent">
          Unlock Instagram Growth with AI
        </h1>
        <p className="text-lg md:text-xl text-gray-700 max-w-3xl mb-8">
          The all-in-one dashboard for creators, brands, and marketers. Analyze, grow, and stay ahead of the trends with powerful analytics and AI tools.
        </p>
        <a href="/trending" className="inline-block px-8 py-3 rounded-lg font-bold text-lg bg-gradient-to-r from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white shadow-lg hover:scale-105 transition-transform">
          Explore Trending Now
        </a>
      </section>

      {/* Highlights/Features Section */}
      <section className="w-full py-12 px-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {highlights.map((feature, i) => (
          <div key={i} className="bg-white rounded-2xl shadow p-6 flex flex-col items-center text-center hover:shadow-lg transition-shadow">
            <div className="text-4xl mb-3">{feature.icon}</div>
            <h3 className="font-bold text-lg mb-2 text-gray-900">{feature.title}</h3>
            <p className="text-gray-600 text-base">{feature.description}</p>
            
          </div>
        ))}
      </section>

      {/* Call to Action */}
      <section className="w-full py-12 flex flex-col items-center bg-gradient-to-r from-[#f9ce34]/10 via-[#ee2a7b]/10 to-[#6228d7]/10 rounded-2xl mb-12">
        <h2 className="text-2xl md:text-3xl font-bold mb-4">Ready to get started?</h2>
        <a href="/subscription" className="inline-block px-8 py-3 rounded-lg font-bold text-lg bg-[#8b5cf6] text-white shadow hover:bg-[#7c3aed] transition-colors">
          View Subscription Plans
        </a>
      </section>

      {/* Footer */}
      <footer className="border-t py-6 mt-8">
        <div className="flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row">
          <div className="flex flex-row gap-6 text-sm text-muted-foreground mb-2 md:mb-0">
            <a href="/terms-and-conditions" className="hover:text-insta-primary transition-colors">Terms of Service</a>
            <a href="/privacy" className="hover:text-insta-primary transition-colors">Privacy Policy</a>
            <a href="/refund" className="hover:text-insta-primary transition-colors">Refund Policy</a>
          </div>
          <p className="text-sm text-muted-foreground text-center md:text-left">
            &copy; {new Date().getFullYear()} InstaTrend Seeker. All rights reserved.
          </p>
          <p className="text-sm text-muted-foreground">
            Data refreshes every 24 hours
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
