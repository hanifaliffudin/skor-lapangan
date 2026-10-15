import type { Locale } from "./i18n";

export const SITE_ORIGIN = "https://skor-lapangan.vercel.app";

type SeoSchema = Record<string, unknown>;

type SeoMetadata = {
  locale: Locale;
  path: string;
  title: string;
  description: string;
  robots?: "index, follow" | "noindex, nofollow";
  type?: "website" | "article";
  schema?: SeoSchema;
};

function absoluteUrl(path: string) {
  return `${SITE_ORIGIN}${path === "/" ? "/" : path}`;
}

function setMeta(attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(
    `meta[${attribute}="${key}"]`,
  );
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.append(element);
  }
  element.content = content;
}

function setLink(rel: string, key: string, href: string) {
  let element = document.head.querySelector<HTMLLinkElement>(
    `link[rel="${rel}"][hreflang="${key}"]`,
  );
  if (!element) {
    element = document.createElement("link");
    element.rel = rel;
    element.hreflang = key;
    document.head.append(element);
  }
  element.href = href;
}

function setSchema(schema: SeoSchema) {
  let element = document.head.querySelector<HTMLScriptElement>(
    "script[data-seo-schema]",
  );
  if (!element) {
    element = document.createElement("script");
    element.type = "application/ld+json";
    element.dataset.seoSchema = "true";
    document.head.append(element);
  }
  element.textContent = JSON.stringify(schema);
}

export function applySeoMetadata({
  locale,
  path,
  title,
  description,
  robots = "index, follow",
  type = "website",
  schema,
}: SeoMetadata) {
  const canonicalUrl = absoluteUrl(path);
  const englishPath = path.replace(/^\/id(?=\/|$)/, "") || "/";
  const indonesianPath = path.startsWith("/id")
    ? path
    : `/id${path === "/" ? "/" : path}`;
  const englishUrl = absoluteUrl(englishPath);
  const indonesianUrl = absoluteUrl(indonesianPath);

  document.documentElement.lang = locale;
  document.title = title;
  setMeta("name", "description", description);
  setMeta("name", "robots", robots);
  setMeta("property", "og:type", type);
  setMeta("property", "og:site_name", "Skor Lapangan");
  setMeta("property", "og:title", title);
  setMeta("property", "og:description", description);
  setMeta("property", "og:url", canonicalUrl);
  setMeta("property", "og:locale", locale === "id" ? "id_ID" : "en_US");
  setMeta(
    "property",
    "og:locale:alternate",
    locale === "id" ? "en_US" : "id_ID",
  );
  setMeta("name", "twitter:card", "summary");
  setMeta("name", "twitter:title", title);
  setMeta("name", "twitter:description", description);

  let canonical = document.head.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]',
  );
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.append(canonical);
  }
  canonical.href = canonicalUrl;

  setLink("alternate", "en", englishUrl);
  setLink("alternate", "id", indonesianUrl);
  setLink("alternate", "x-default", englishUrl);

  if (schema) setSchema(schema);
}

export function homeSchema(locale: Locale, description: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Skor Lapangan",
    url: absoluteUrl(locale === "id" ? "/id/" : "/"),
    inLanguage: locale,
    description,
  } satisfies SeoSchema;
}

export function communityRulesSchema(
  locale: Locale,
  title: string,
  description: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description,
    url: absoluteUrl(locale === "id" ? "/id/rules" : "/rules"),
    inLanguage: locale,
    isPartOf: {
      "@type": "WebSite",
      name: "Skor Lapangan",
      url: absoluteUrl(locale === "id" ? "/id/" : "/"),
    },
  } satisfies SeoSchema;
}
