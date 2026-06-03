type DirectoryPillProps = {
  name: string;
  logoSrc: string;
  logoAlt: string;
  status: "verified" | "soon";
  href?: string;
};

function DirectoryLogo({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      src={src}
      alt={alt}
      width={24}
      height={24}
      className="h-6 w-6 flex-shrink-0 rounded-md object-contain"
      loading="lazy"
      decoding="async"
    />
  );
}

function DirectoryPill({ name, logoSrc, logoAlt, status, href }: DirectoryPillProps) {
  const className =
    "flex items-center gap-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2 transition-colors " +
    (status === "verified"
      ? "hover:border-gray-300"
      : "opacity-60 cursor-default");

  const content = (
    <>
      <DirectoryLogo src={logoSrc} alt={logoAlt} />
      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{name}</span>
      {status === "verified" ? (
        <span className="text-xs font-medium text-emerald-600" aria-label="Verified listing">
          ✓
        </span>
      ) : (
        <span className="text-xs text-gray-400">Soon</span>
      )}
    </>
  );

  if (href && status === "verified") {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {content}
      </a>
    );
  }

  return <div className={className}>{content}</div>;
}

const DIRECTORY_LISTINGS: DirectoryPillProps[] = [
  {
    name: "GetApp",
    logoSrc: "/logos/getapp.png",
    logoAlt: "GetApp logo",
    status: "verified",
    href: "https://www.getapp.com/marketing-software/a/insytiq/",
  },
  {
    name: "Product Hunt",
    logoSrc: "/logos/product-hunt.png",
    logoAlt: "Product Hunt logo",
    status: "verified",
    href: "https://www.producthunt.com/products/insytiq-ai-2",
  },
  {
    name: "G2",
    logoSrc: "/logos/g2.png",
    logoAlt: "G2 logo",
    status: "soon",
  },
  {
    name: "Capterra",
    logoSrc: "/logos/capterra.png",
    logoAlt: "Capterra logo",
    status: "soon",
  },
];

const STATS = [
  { num: "12K+", sub: "Public accounts analysed since launch" },
  { num: "24hr", sub: "Global Instagram data refresh cycle" },
  { num: "0", sub: "Instagram logins required — ever" },
] as const;

export function SocialProof() {
  return (
    <section className="py-16 px-4">

      {/* ── Stats highlight ── */}
      <div
        className="mx-auto mb-10 max-w-2xl rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/90 via-white to-pink-50/80 p-6 shadow-sm md:p-8"
        aria-labelledby="social-proof-by-the-numbers"
      >
        <p
          id="social-proof-by-the-numbers"
          className="mb-6 text-center text-xs font-bold uppercase tracking-[0.2em] text-[#7c1d5c]"
        >
          By the numbers
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-3">
          {STATS.map(({ num, sub }) => (
            <div
              key={num}
              className="rounded-xl border border-violet-100/80 bg-white/80 px-4 py-5 text-center shadow-sm backdrop-blur-sm"
            >
              <p className="bg-gradient-to-r from-[#ee2a7b] via-[#c0257a] to-[#6228d7] bg-clip-text text-3xl font-bold tracking-tight text-transparent md:text-4xl">
                {num}
              </p>
              <p className="mt-2 text-xs font-medium leading-snug text-gray-600">{sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Divider ── */}
      <hr className="border-t border-gray-100 dark:border-white/10 max-w-2xl mx-auto mb-8" />

      {/* ── Directory listings ── */}
      <p className="text-xs text-gray-400 text-center mb-5">Listed and verified on</p>

      <div className="flex flex-wrap justify-center gap-3 max-w-xl mx-auto mb-10">
        {DIRECTORY_LISTINGS.map((listing) => (
          <DirectoryPill key={listing.name} {...listing} />
        ))}
      </div>

      {/* ── Honest early-access note ── */}
      <div className="max-w-xl mx-auto bg-gray-50 dark:bg-white/5 rounded-xl px-5 py-4 flex gap-3">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
          <strong className="text-gray-700 dark:text-gray-300">Early access tool.</strong>{' '}
          Reviews and press coverage are being collected as we grow. If you've used Insytiq
          and want to leave a review, we'd genuinely appreciate it on{' '}
          <a
            href="https://www.getapp.com/marketing-software/a/insytiq/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#7c1d5c] underline underline-offset-2"
          >
            GetApp
          </a>{' '}
          or{' '}
          <a
            href="https://www.producthunt.com/products/insytiq-ai-2"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#7c1d5c] underline underline-offset-2"
          >
            Product Hunt
          </a>.
        </p>
      </div>

    </section>
  )
}
