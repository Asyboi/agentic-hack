/**
 * Live Policy Guard articles on cited.md (from `senso content verification --status published`).
 * cited.md uses /article/<slug>, not /{org-slug}/{decision-id}.
 */
export const CITED_MD_CORPUS_HUB =
  "https://cited.md/software-and-saas/ai-agent-compliance-apis";

export const CITED_MD_LIVE_ARTICLES = [
  {
    title: "What is PolicyGuard?",
    url: "https://cited.md/article/what-is-policyguard",
  },
  {
    title: "How PolicyGuard cites policy evidence",
    url: "https://cited.md/article/how-does-policyguard-cite-policy-evidence",
  },
  {
    title: "PolicyGuard vs hardcoded compliance",
    url: "https://cited.md/article/how-does-policyguard-compare-to-hardcoded-compliance-logic",
  },
] as const;

/** Only show "Published on cited.md" when the URL is a real cited.md article path. */
export function isValidCitedMdArticleUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return (
      u.hostname === "cited.md" &&
      u.pathname.startsWith("/article/") &&
      u.pathname.length > "/article/".length
    );
  } catch {
    return false;
  }
}
