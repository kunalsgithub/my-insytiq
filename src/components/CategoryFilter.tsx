import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Category {
  id: string;
  name: string;
}

interface CategoryFilterProps {
  onCategoryChange: (category: string) => void;
}

const categories: Category[] = [
  { id: "all", name: "All Trends" },
  { id: "sports", name: "Sports" },
  { id: "memes", name: "Memes" },
  { id: "photography", name: "Photography" },
  { id: "fashion", name: "Fashion" },
  { id: "food", name: "Food" },
  { id: "travel", name: "Travel" },
  { id: "news", name: "News" },
  { id: "tech", name: "Technology" },
  { id: "beauty", name: "Beauty" },
  { id: "music", name: "Music" },
  { id: "fitness", name: "Fitness" }
];

const CategoryFilter = ({ onCategoryChange }: CategoryFilterProps) => {
  const [activeCategory, setActiveCategory] = useState("all");

  const handleCategoryChange = (categoryId: string) => {
    setActiveCategory(categoryId);
    onCategoryChange(categoryId);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((category) => (
        <Button
          key={category.id}
          variant={activeCategory === category.id ? "default" : "outline"}
          size="sm"
          onClick={() => handleCategoryChange(category.id)}
          className={`${
            activeCategory === category.id
              ? "bg-insta-primary text-white"
              : "hover:bg-insta-primary/10"
          }`}
        >
          {category.name}
        </Button>
      ))}
    </div>
  );
};

export default CategoryFilter;
