import React, { useEffect, useRef } from 'react';
import { TrendingContent } from '@/services/instagramService';

interface InstagramEmbedProps {
  content: TrendingContent;
  className?: string;
}

declare global {
  interface Window {
    instgrm?: {
      Embeds: {
        process(): void;
      };
    };
  }
}

export const InstagramEmbed: React.FC<InstagramEmbedProps> = ({ content, className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load Instagram embed script if not already loaded
    if (!window.instgrm) {
      const script = document.createElement('script');
      script.src = '//www.instagram.com/embed.js';
      script.async = true;
      script.onload = () => {
        if (window.instgrm) {
          window.instgrm.Embeds.process();
        }
      };
      document.body.appendChild(script);
    } else {
      // If script is already loaded, just process embeds
      window.instgrm.Embeds.process();
    }

    // Cleanup function
    return () => {
      const script = document.querySelector('script[src="//www.instagram.com/embed.js"]');
      if (script) {
        document.body.removeChild(script);
      }
    };
  }, [content.embedHtml]);

  if (!content.embedHtml) {
    // Fallback for when embed HTML is not available
    return (
      <div className={`instagram-fallback ${className}`} style={{ 
        background: content.thumbnailColor,
        padding: '16px',
        borderRadius: '8px',
        textAlign: 'center'
      }}>
        <a 
          href={content.mediaUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-white hover:underline"
        >
          View on Instagram
        </a>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`instagram-embed-container ${className}`}
      dangerouslySetInnerHTML={{ __html: content.embedHtml }}
    />
  );
};

// Add some global styles for Instagram embeds
const styles = `
  .instagram-embed-container {
    margin: 1rem 0;
    max-width: 540px;
    width: 100%;
  }

  .instagram-embed-container iframe {
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  .instagram-fallback {
    min-height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
`;

// Add styles to document head
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}

export default InstagramEmbed; 