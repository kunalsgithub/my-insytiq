import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Plus, X } from "lucide-react";

type FaqCategory =
  | "all"
  | "general"
  | "features"
  | "data"
  | "pricing"
  | "getting-started";

type FaqItem = {
  id: number;
  category: Exclude<FaqCategory, "all">;
  question: string;
  answer: string;
};

const FAQ_ITEMS: FaqItem[] = [
  {
    id: 1,
    category: "general",
    question: "What is Insytiq?",
    answer:
      "Insytiq is a real-time Instagram analytics platform built for creators and social media marketers. It tracks trending Reels, sounds, hashtags, and content patterns on Instagram — giving you data-backed insights so you can create content that actually performs.",
  },
  {
    id: 2,
    category: "general",
    question: "Who is Insytiq built for?",
    answer:
      "Insytiq is built for Instagram creators, influencers, social media managers, and marketing teams who want to grow their reach. Whether you post for a personal brand, a business, or manage multiple client accounts, Insytiq helps you stay ahead of trends before they peak.",
  },
  {
    id: 3,
    category: "general",
    question: "How is Insytiq different from Instagram Insights?",
    answer:
      "Instagram Insights only shows data about your own account. Insytiq shows you what's trending across the entire platform in real time — which sounds are rising, which hashtags are gaining momentum, and which content formats are getting the most reach — before you even post.",
  },
  {
    id: 4,
    category: "general",
    question: "Does Insytiq work for business accounts and creator accounts?",
    answer:
      "Yes. Insytiq works for both Instagram business and creator accounts. You don't need to connect your Instagram account to use the trend data — simply sign up and start discovering what's performing on the platform right now.",
  },
  {
    id: 5,
    category: "features",
    question: "What does Insytiq track?",
    answer:
      "Insytiq tracks trending Reels formats, rising audio and sounds, high-momentum hashtags, and content patterns — all updated in real time so you always know what's working on Instagram before it saturates your niche.",
  },
  {
    id: 6,
    category: "features",
    question: "Can I track trending Instagram audio and sounds?",
    answer:
      "Yes — trending audio tracking is one of Insytiq's core features. You can see which sounds are rising in usage and how quickly they're gaining momentum. The best time to use a sound is when it's climbing but hasn't yet peaked — that's when Instagram gives it the most algorithmic reach.",
  },
  {
    id: 7,
    category: "features",
    question: "Does Insytiq show trending hashtags?",
    answer:
      "Yes. Insytiq tracks hashtag momentum in real time, showing you which hashtags are growing, which are peaking, and which are declining. This helps you build posts around tags that are actively being discovered by new audiences right now.",
  },
  {
    id: 8,
    category: "features",
    question: "Can I use Insytiq to analyze competitor accounts?",
    answer:
      "Insytiq focuses on platform-wide trend data rather than individual account tracking. You can use the insights to understand what content styles work broadly in your niche, helping you benchmark against competitors and identify content gaps you can fill.",
  },
  {
    id: 9,
    category: "features",
    question: "Does Insytiq help with content ideas?",
    answer:
      "Absolutely. By showing you what trends are rising — a specific audio, a Reel format, or a content theme — Insytiq gives you a constant stream of data-backed content ideas so you always know what to post next.",
  },
  {
    id: 10,
    category: "features",
    question: "Is there a mobile app?",
    answer:
      "Insytiq is currently available as a web platform, fully optimized for mobile browsers. Access your trend dashboard from your phone, tablet, or desktop without downloading anything.",
  },
  {
    id: 11,
    category: "data",
    question: "How real-time is the data?",
    answer:
      "Insytiq tracks Instagram trends continuously and updates in near real-time. Trend timing is critical on Instagram — the algorithm rewards early adopters, so fresher data means a bigger advantage for your content.",
  },
  {
    id: 12,
    category: "data",
    question: "How accurate is Insytiq's trend data?",
    answer:
      "Insytiq analyzes publicly available Instagram data at scale to surface genuine trend signals. When something shows as rising in our data, it's rising on the platform — giving you reliable, actionable intelligence rather than lagging indicators.",
  },
  {
    id: 13,
    category: "data",
    question: "Does Insytiq use Instagram's official API?",
    answer:
      "Insytiq uses compliant methods to surface trend data from Instagram's public content and follows Meta's platform policies to ensure reliability for all users.",
  },
  {
    id: 14,
    category: "data",
    question: "What countries and languages does the data cover?",
    answer:
      "Insytiq's trend data covers global Instagram activity and is not limited to a single country or language — useful whether you're creating for a local audience or building a global following.",
  },
  {
    id: 15,
    category: "pricing",
    question: "Is Insytiq free to use?",
    answer:
      "Insytiq offers a free plan so you can explore the platform and start discovering trends without entering a credit card. Paid plans unlock deeper analytics, more frequent updates, and additional features for power users and teams.",
  },
  {
    id: 16,
    category: "pricing",
    question: "Do you offer a free trial?",
    answer:
      "Yes. Get started with Insytiq for free and experience core trend-tracking features with no commitment. Upgrade at any time — and you're never locked into a contract.",
  },
  {
    id: 17,
    category: "pricing",
    question: "Is there a plan for agencies managing multiple clients?",
    answer:
      "Yes. Insytiq offers plans for agencies managing multiple Instagram accounts, with expanded data access and the ability to track trends across multiple niches simultaneously. Contact us for custom agency pricing.",
  },
  {
    id: 18,
    category: "getting-started",
    question: "Do I need to connect my Instagram account?",
    answer:
      "No. You do not need to connect or log in with your Instagram account to use Insytiq's trend data. Simply create an account and immediately start tracking trending audio, hashtags, and Reels.",
  },
  {
    id: 19,
    category: "getting-started",
    question: "How do I get started with Insytiq?",
    answer:
      "Sign up for a free account, choose your niche or content category, and Insytiq will immediately show you what's trending on Instagram right now. No setup required — takes less than two minutes.",
  },
  {
    id: 20,
    category: "getting-started",
    question: "How often should I check Insytiq?",
    answer:
      "We recommend checking Insytiq 2–3 times per week. Audio and format trends on Instagram typically have a 7–10 day peak window before saturating. Checking regularly means you catch trends while they're still rising.",
  },
];

const TABS: { key: FaqCategory; label: string }[] = [
  { key: "all", label: "All" },
  { key: "general", label: "General" },
  { key: "features", label: "Features" },
  { key: "data", label: "Data & Accuracy" },
  { key: "pricing", label: "Pricing" },
  { key: "getting-started", label: "Getting Started" },
];

export default function FAQSection() {
  const [filter, setFilter] = useState<FaqCategory>("all");
  const [openId, setOpenId] = useState<number | null>(null);

  const visible = useMemo(
    () =>
      filter === "all"
        ? FAQ_ITEMS
        : FAQ_ITEMS.filter((item) => item.category === filter),
    [filter]
  );

  const faqJsonLd = useMemo(
    () =>
      JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: FAQ_ITEMS.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      }),
    []
  );

  const toggle = (id: number) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <>
      <Helmet>
        <script type="application/ld+json">{faqJsonLd}</script>
      </Helmet>

      <section
        id="faq"
        className="border-t border-gray-200 bg-white py-12 md:py-20"
        aria-label="Frequently asked questions"
      >
        <div className="mx-auto max-w-[760px] px-4 md:px-6">
          <h2 className="text-center text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
            Frequently asked questions
          </h2>

          <div
            className="mt-8 flex flex-wrap justify-center gap-2 md:mt-10"
            role="tablist"
            aria-label="FAQ categories"
          >
            {TABS.map((tab) => {
              const active = filter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setFilter(tab.key);
                    setOpenId(null);
                  }}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "border-[#c0257a] bg-[#fdf2f8] text-[#a01d68]"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <ul className="mt-8 list-none divide-y divide-gray-200 border-t border-gray-200 p-0 md:mt-10">
            {visible.map((item) => {
              const isOpen = openId === item.id;
              const headingId = `faq-heading-${item.id}`;
              const panelId = `faq-panel-${item.id}`;
              return (
                <li key={item.id} className="py-0">
                  <button
                    type="button"
                    id={`faq-trigger-${item.id}`}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => toggle(item.id)}
                    className="flex w-full items-start justify-between gap-4 py-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c0257a] focus-visible:ring-offset-2 rounded-lg"
                  >
                    <h3
                      id={headingId}
                      className="text-base font-medium leading-snug text-gray-900 pr-2"
                    >
                      {item.question}
                    </h3>
                    <span
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-600 transition-transform ease-in-out ${
                        isOpen ? "rotate-90 border-[#c0257a]/30 bg-[#fdf2f8] text-[#c0257a]" : ""
                      }`}
                      style={{ transitionDuration: "250ms" }}
                      aria-hidden
                    >
                      {isOpen ? (
                        <X className="h-4 w-4" strokeWidth={2.25} />
                      ) : (
                        <Plus className="h-4 w-4" strokeWidth={2.25} />
                      )}
                    </span>
                  </button>
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={headingId}
                    className="overflow-hidden"
                    style={{
                      maxHeight: isOpen ? 1200 : 0,
                      transition: "max-height 250ms ease-in-out",
                    }}
                  >
                    <div className="pb-5 pt-0">
                      <p className="text-[15px] leading-[1.75] text-gray-600">
                        {item.answer}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </>
  );
}
