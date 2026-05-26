import { useEffect } from 'react';

/**
 * A custom hook to set SEO meta tags per route.
 * @param {Object} options
 * @param {string} options.title - The page title.
 * @param {string} options.description - The meta description.
 * @param {string} options.url - The canonical URL path (e.g., "/lab-generator").
 */
export function useSEO({ title, description, url }) {
  useEffect(() => {
    // 1. Update title
    if (title) {
      document.title = title;
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) ogTitle.setAttribute('content', title);
    }

    // 2. Update description
    if (description) {
      let metaDesc = document.querySelector('meta[name="description"]');
      if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.setAttribute('name', 'description');
        document.head.appendChild(metaDesc);
      }
      metaDesc.setAttribute('content', description);

      let ogDesc = document.querySelector('meta[property="og:description"]');
      if (!ogDesc) {
        ogDesc = document.createElement('meta');
        ogDesc.setAttribute('property', 'og:description');
        document.head.appendChild(ogDesc);
      }
      ogDesc.setAttribute('content', description);
    }

    // 3. Update URL
    if (url) {
      const fullUrl = `https://lab-craft.vercel.app${url}`;
      let ogUrl = document.querySelector('meta[property="og:url"]');
      if (!ogUrl) {
        ogUrl = document.createElement('meta');
        ogUrl.setAttribute('property', 'og:url');
        document.head.appendChild(ogUrl);
      }
      ogUrl.setAttribute('content', fullUrl);
    }
  }, [title, description, url]);
}
