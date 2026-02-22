import { useState } from "react";
import TrendingHashtags from "../components/TrendingHashtags";
import TrendingContent from "../components/TrendingContent";
import InstagramNews from "../components/InstagramNews";
import TopInsightsThisWeek from "../components/TopInsightsThisWeek";
import ScrollVelocity from "../components/ScrollVelocity";

const TrendingNow = () => {
  const [selectedCategory, setSelectedCategory] = useState("all");

  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-2 py-4 md:px-0 md:items-stretch">
      {/* Animated Headline */}
      <div className="w-full max-w-xl mx-auto mb-2 md:max-w-[1440px] md:px-4 md:mx-auto md:mb-2">
        <div className="block lg:hidden">
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
        <div className="hidden lg:block w-full">
          <div className="w-full max-w-[1440px] mx-auto px-4">
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
      </div>

      {/* Main content area: mobile = stacked cards, desktop = grid */}
      <div className="block md:hidden w-full max-w-xl mx-auto">
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

      {/* Desktop grid layout */}
      <div className="hidden md:block relative w-full max-w-[1440px] mx-auto px-4 md:px-6 flex-1 mt-0 lg:mt-56 lg:ml-[260px]">
        <main className="py-8 sm:py-12">
          <div className="flex flex-col md:grid md:grid-cols-12 gap-6 lg:gap-12 w-full max-w-screen px-4">
            {/* Sidebar: Hashtags + Insights side by side */}
            <div className="w-full md:col-span-3 flex flex-col gap-6 mb-6 md:mb-0">
              <div className="md:bg-transparent md:rounded-none md:shadow-none md:p-0 md:my-0">
                <TopInsightsThisWeek />
              </div>
              <div className="md:bg-transparent md:rounded-none md:shadow-none md:p-0 md:my-0">
                <TrendingHashtags selectedCategory={selectedCategory} />
              </div>
            </div>
            {/* Main content */}
            <div className="w-full md:col-span-9 space-y-8">
              <div className="md:bg-transparent md:rounded-none md:shadow-none md:p-0 md:my-0">
                <TrendingContent selectedCategory={selectedCategory} />
              </div>
              <div className="md:bg-transparent md:rounded-none md:shadow-none md:p-0 md:my-0 mt-0 w-full">
                <InstagramNews />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default TrendingNow; 