// English UI strings (the source of truth for the dictionary shape). `es.ts` is typed
// `satisfies Dictionary`, so a key added here without a Spanish twin fails `tsc`;
// tests/unit/i18n-dictionaries.test.ts is the runtime twin. Plain strings only (no `as const`)
// so the shape — not the English literals — is the contract.
export const en = {
  nav: {
    teams: "Teams",
    events: "Events",
    news: "News",
    involved: "Get Involved",
    shop: "Shop",
    about: "About",
    donate: "Support the Federation",
    donateShort: "Support",
    menu: "Menu",
    toggle: "Toggle navigation",
    primary: "Primary",
  },
  locale: {
    switcher: "Language",
    en: "English",
    es: "Spanish",
  },
  footer: {
    homeLabel: "USVI Softball Federation — home",
    contact: "Contact",
    explore: "Explore",
    follow: "Follow",
    navLabel: "Footer",
    opensPaypal: "(opens PayPal)",
    tagline: "From the Virgin Islands to the World.",
    rights: "U.S. Virgin Islands Softball Federation. All rights reserved.",
  },
};

export type Dictionary = typeof en;
