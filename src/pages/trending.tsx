import { useState } from "react";
import TrendingHashtags from "@/components/TrendingHashtags";
import TrendingContent from "@/components/TrendingContent";
import InstagramNews from "@/components/InstagramNews";
import ScrollVelocity from "@/components/ScrollVelocity";
import TopInsightsThisWeek from "@/components/TopInsightsThisWeek";

const Trending = () => {
  const [selectedCategory, setSelectedCategory] = useState("all");

  return (
    <div className="relative min-h-screen flex flex-col bg-background">
      {/* Headline: responsive, edge-to-edge on desktop, contained on mobile */}
      <div className="relative w-full">
        {/* Mobile/Tablet: contained headline */}
        <div className="block lg:hidden w-full max-w-xl mx-auto px-2 py-4 mb-2">
          <ScrollVelocity
            texts={["Discover what's trending on Instagram"]}
            velocity={100}
            className="gradient-text custom-scroll-text text-2xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-orange-400 text-transparent bg-clip-text text-center"
          />
          <ScrollVelocity
            texts={["across different categories"]}
            velocity={-100}
            className="gradient-text custom-scroll-text text-2xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-orange-400 text-transparent bg-clip-text text-center"
          />
        </div>
        {/* Desktop: edge-to-edge headline, animated, absolute positioning */}
        <div className="hidden lg:block w-screen absolute left-0 right-0 mt-8 mb-8 z-10 pointer-events-none">
          <ScrollVelocity
            texts={["Discover what's trending on Instagram"]}
            velocity={100}
            className="gradient-text custom-scroll-text text-4xl xl:text-6xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-orange-400 text-transparent bg-clip-text text-center"
          />
          <ScrollVelocity
            texts={["across different categories"]}
            velocity={-100}
            className="gradient-text custom-scroll-text text-4xl xl:text-6xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-orange-400 text-transparent bg-clip-text text-center"
          />
        </div>
      </div>

      {/* Mobile: stacked cards layout */}
      <div className="block md:hidden w-full max-w-xl mx-auto px-2">
        {/* Top Performers Card */}
        <section className="w-full bg-white rounded-2xl shadow p-5 mb-6">
          <TopInsightsThisWeek />
        </section>
        {/* Trending Hashtags Card */}
        <section className="w-full bg-white rounded-2xl shadow p-5 mb-6">
          <h2 className="font-bold text-lg mb-3 text-center text-[#a259e6] flex items-center justify-center gap-2">
            <span className="text-2xl">🏷️</span> Trending Hashtags
          </h2>
          <TrendingHashtags selectedCategory={selectedCategory} />
        </section>
        {/* Trending Content Card */}
        <section className="w-full bg-white rounded-2xl shadow p-5 mb-6">
          <h2 className="font-bold text-lg mb-3 text-center text-[#ee2a7b] flex items-center justify-center gap-2">
            <span className="text-2xl">📸</span> Trending Content
          </h2>
          <TrendingContent selectedCategory={selectedCategory} />
        </section>
        {/* Instagram News Card */}
        <section className="w-full bg-white rounded-2xl shadow p-5 mb-6">
          <h2 className="font-bold text-lg mb-3 text-center text-[#6228d7] flex items-center justify-center gap-2">
            <span className="text-2xl">📰</span> Instagram News
          </h2>
          <InstagramNews />
        </section>
      </div>

      {/* Desktop: Main content area, centered and wide */}
      <div className="hidden md:block relative w-full max-w-full mx-auto md:max-w-[1440px] md:w-full md:mx-auto px-4 md:px-6 flex-1 mt-0 lg:mt-56 lg:ml-[260px]">
        <main className="py-8 sm:py-12">
          <div className="flex flex-col md:grid md:grid-cols-12 gap-6 lg:gap-12 w-full max-w-screen px-0 md:px-4">
            {/* Sidebar: Hashtags + Insights side by side */}
            <div className="w-full md:col-span-3 flex flex-col gap-6 mb-6 md:mb-0">
              <div className="bg-white rounded-2xl shadow p-4 my-4 w-full px-2 md:bg-transparent md:rounded-none md:shadow-none md:p-0 md:my-0">
                <TopInsightsThisWeek />
              </div>
              <div className="bg-white rounded-2xl shadow p-4 my-4 w-full px-2 md:bg-transparent md:rounded-none md:shadow-none md:p-0 md:my-0">
                <TrendingHashtags selectedCategory={selectedCategory} />
              </div>
            </div>
            {/* Main content */}
            <div className="w-full md:col-span-9 space-y-8">
              <div className="bg-white rounded-2xl shadow p-4 my-4 w-full px-2 md:bg-transparent md:rounded-none md:shadow-none md:p-0 md:my-0">
                <TrendingContent selectedCategory={selectedCategory} />
              </div>
              <div className="bg-white rounded-2xl shadow p-4 my-4 w-full px-2 md:bg-transparent md:rounded-none md:shadow-none md:p-0 md:my-0 mt-0 w-full">
                <InstagramNews />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Trending; 