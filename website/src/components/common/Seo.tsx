import { siteConfig } from '../../config/site';
import { absoluteUrl } from '../../utils/url';

interface SeoProps {
  title: string;
  description: string;
  /** Route path, e.g. "/features". */
  path: string;
  /** JSON-LD objects rendered for this page. */
  jsonLd?: Record<string, unknown>[];
  noIndex?: boolean;
}

/**
 * Per-page metadata. React 19 hoists <title>, <meta> and <link> rendered anywhere in the tree
 * into <head>, so no helmet library is needed.
 */
export default function Seo({ title, description, path, jsonLd, noIndex }: SeoProps) {
  const fullTitle = path === '/' ? title : `${title} | ${siteConfig.name}`;
  const url = absoluteUrl(path);
  const image = absoluteUrl('/og-image.png');

  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noIndex && <meta name="robots" content="noindex, follow" />}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={siteConfig.name} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={`${siteConfig.name} — ${siteConfig.shortDescription}`} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      {jsonLd?.map((data, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(data)}
        </script>
      ))}
    </>
  );
}
