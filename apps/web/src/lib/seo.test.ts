import { beforeEach, describe, expect, it } from "vitest";
import { applySeoMetadata, communityRulesSchema, homeSchema } from "./seo";

describe("SEO metadata", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.documentElement.lang = "en";
  });

  it("builds localized homepage metadata with linked alternates", () => {
    applySeoMetadata({
      locale: "id",
      path: "/id/",
      title: "Papan skor",
      description: "Catat skor olahraga raket.",
      schema: homeSchema("id", "Catat skor olahraga raket."),
    });

    expect(document.documentElement).toHaveAttribute("lang", "id");
    expect(document.title).toBe("Papan skor");
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute(
      "content",
      "index, follow",
    );
    expect(
      document.head.querySelector('link[rel="canonical"]'),
    ).toHaveAttribute("href", "https://skor-lapangan.vercel.app/id/");
    expect(
      document.head.querySelector('link[rel="alternate"][hreflang="en"]'),
    ).toHaveAttribute("href", "https://skor-lapangan.vercel.app/");
    expect(
      document.head.querySelector("script[data-seo-schema]"),
    ).toHaveTextContent('"WebSite"');
  });

  it("marks utility pages as noindex and uses the localized rules schema", () => {
    applySeoMetadata({
      locale: "en",
      path: "/rules/private/edit",
      title: "Private rules",
      description: "Private rules.",
      robots: "noindex, nofollow",
      schema: communityRulesSchema("en", "Private rules", "Private rules."),
    });

    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex, nofollow",
    );
    expect(
      JSON.parse(
        document.head.querySelector<HTMLScriptElement>(
          "script[data-seo-schema]",
        )!.textContent!,
      ),
    ).toMatchObject({
      "@type": "CollectionPage",
      inLanguage: "en",
    });
  });
});
