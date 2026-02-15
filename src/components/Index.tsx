import { useState } from "react";
import TrendingHashtags from "@/components/TrendingHashtags";
import TrendingContent from "@/components/TrendingContent";
import CategoryFilter from "@/components/CategoryFilter";
import InstagramNews from "@/components/InstagramNews";
import ScrollVelocity from "@/components/ScrollVelocity";

const Index = () => {
  const [selectedCategory, setSelectedCategory] = useState("all");

  return (
    <main className="flex-1 w-full px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <TrendingContent selectedCategory={selectedCategory} />
          <TrendingHashtags selectedCategory={selectedCategory} />
          <InstagramNews />
          <div className="w-full overflow-x-auto">
            <ScrollVelocity
              texts={["Discover what's trending on Instagram"]}
              velocity={100}
              className="gradient-text custom-scroll-text text-2xl md:text-4xl lg:text-5xl"
            />
            <ScrollVelocity
              texts={["across different categories"]}
              velocity={-100}
              className="gradient-text custom-scroll-text text-2xl md:text-4xl lg:text-5xl"
            />
          </div>
        </div>
        <div className="space-y-6">
          <CategoryFilter onCategoryChange={setSelectedCategory} />
        </div>
      </div>
    </main>
  );
};

export default Index; 
