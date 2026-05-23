/** Demo PM vendors — replace with Nimble discovery when wired */
export type VendorCatalogEntry = {
  name: string;
  domain: string;
  pricing_url: string;
  trial_url: string;
  price_per_user: string;
  why_startup: string;
  policy_urls: string[];
};

export const PM_VENDOR_CATALOG: VendorCatalogEntry[] = [
  {
    name: "Notion",
    domain: "notion.so",
    pricing_url: "https://www.notion.so/pricing",
    trial_url: "https://www.notion.so/product",
    price_per_user: "$10/user",
    why_startup:
      "Flexible docs + wikis for a 50-person team without heavy admin overhead.",
    policy_urls: ["https://www.notion.so/terms", "https://www.notion.so/robots.txt"],
  },
  {
    name: "Asana",
    domain: "asana.com",
    pricing_url: "https://asana.com/pricing",
    trial_url: "https://asana.com/create-account",
    price_per_user: "$10.99/user",
    why_startup:
      "Strong task dependencies and timelines for cross-functional startup squads.",
    policy_urls: ["https://asana.com/terms", "https://asana.com/robots.txt"],
  },
  {
    name: "Trello",
    domain: "trello.com",
    pricing_url: "https://trello.com/pricing",
    trial_url: "https://trello.com/signup",
    price_per_user: "$5/user",
    why_startup:
      "Kanban-first, low learning curve when the team wants visual boards fast.",
    policy_urls: ["https://trello.com/legal/terms", "https://trello.com/robots.txt"],
  },
  {
    name: "ClickUp",
    domain: "clickup.com",
    pricing_url: "https://clickup.com/pricing",
    trial_url: "https://clickup.com/signup",
    price_per_user: "$7/user",
    why_startup:
      "All-in-one views (list/board/doc) if you want one tool instead of many.",
    policy_urls: ["https://clickup.com/terms", "https://clickup.com/robots.txt"],
  },
  {
    name: "Monday.com",
    domain: "monday.com",
    pricing_url: "https://monday.com/pricing",
    trial_url: "https://monday.com/free-trial",
    price_per_user: "$9/user",
    why_startup:
      "Customizable workflows and dashboards for ops-heavy 50-person teams.",
    policy_urls: ["https://monday.com/terms", "https://monday.com/robots.txt"],
  },
];

export const AGGREGATOR_TARGET = {
  name: "G2",
  domain: "g2.com",
  policy_urls: ["https://www.g2.com/terms", "https://www.g2.com/robots.txt"],
};

export const LINKEDIN_TARGET = {
  name: "LinkedIn",
  domain: "linkedin.com",
  policy_urls: ["https://www.linkedin.com/legal/user-agreement"],
};
