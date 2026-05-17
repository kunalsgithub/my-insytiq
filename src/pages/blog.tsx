import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import { blogPosts } from "../data/blogPosts";

export default function BlogPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#fafafa]">
      <Navbar />
      <main className="flex-1 w-full px-4 py-10 md:px-6 md:py-14 lg:px-8">
        <section className="mx-auto max-w-[1080px]">
          <header className="mb-8 md:mb-10">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d72989]">
              INSYTIQ Blog
            </p>
            <h1 className="mt-3 text-3xl font-bold leading-tight text-slate-900 md:text-5xl">
              Latest Articles
            </h1>
            <p className="mt-3 text-base text-slate-600 md:text-lg">
              Insights on Instagram growth, engagement, and benchmarks for Indian
              D2C brands.
            </p>
          </header>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {blogPosts.map((post) => (
              <Link
                key={post.slug}
                to={`/blog/${post.slug}`}
                className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#d72989]">
                  {post.publishedLabel}
                </p>
                <h2 className="mt-3 text-xl font-semibold leading-snug text-slate-900 group-hover:text-[#d72989]">
                  {post.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {post.excerpt}
                </p>
                <p className="mt-5 text-sm font-medium text-slate-900 group-hover:text-[#d72989]">
                  Read article →
                </p>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

