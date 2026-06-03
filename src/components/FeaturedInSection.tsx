import { FEATURED_PLATFORMS, FeaturedLogoMark } from "@/components/featured-in/FeaturedLogoMarks";

export default function FeaturedInSection() {
  return (
    <section
      id="featured-in"
      className="border-t border-gray-100 bg-white px-4 py-14 md:py-20"
      aria-labelledby="featured-in-heading"
    >
      <div className="mx-auto max-w-6xl">
        <h2
          id="featured-in-heading"
          className="text-center text-2xl font-bold tracking-tight text-gray-900 md:text-3xl"
        >
          Featured In
        </h2>

        <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
          {FEATURED_PLATFORMS.map((platform) => (
            <li key={platform.id}>
              <div
                className="rounded-xl border border-gray-200/90 bg-gray-50/40"
                title={platform.name}
              >
                <div className="flex h-[72px] w-full items-center justify-center px-3 sm:h-[80px]">
                  <FeaturedLogoMark id={platform.id} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
