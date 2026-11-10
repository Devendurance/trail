/// BOT Chain ecosystem logos shown orbiting the landing hero.
/// Add real entries here when approved logo files arrive (square master, 256px+,
/// placed under /public/ecosystem). Until then the hero fills with abstract,
/// unlabeled decorative tiles that are not products, not links, and hidden
/// from assistive tech.
export interface EcosystemLogo {
  name: string;
  /** Path under /public, e.g. /ecosystem/bot-names.png */
  src: string;
  /** Dominant saturated colour, precomputed offline. Neutral logos use #B8B8B8. */
  color: string;
  /** Tile background for logos with transparent backgrounds. */
  background?: string;
  href?: string;
  layer: "foreground" | "mid" | "far";
}

export const ECOSYSTEM_LOGOS: EcosystemLogo[] = [
  { name: "Tandot", src: "/ecosystem/tandot.png", color: "#09B8B0", background: "#161616", href: "https://mainnet.tandot.edycu.dev/", layer: "foreground" },
  { name: "MeMeX", src: "/ecosystem/memex.png", color: "#8FFC4F", href: "https://www.memex.fund/", layer: "foreground" },
  { name: "Bo Wallet", src: "/ecosystem/bo-wallet.png", color: "#FD6502", href: "https://wallet.botchain.ai/zh/", layer: "foreground" },
  { name: "BotStarter", src: "/ecosystem/botstarter.png", color: "#03CC76", href: "https://botstarter.fun/", layer: "mid" },
  { name: "B DEX", src: "/ecosystem/b-dex.png", color: "#0245FC", href: "https://dex.botchain.ai/swap", layer: "mid" },
];

/// Decorative stand-ins. Colours follow the DESIGN.md trail examples.
export const DECORATIVE_TILES: { color: string; layer: EcosystemLogo["layer"] }[] = [
  { color: "#E5383B", layer: "foreground" },
  { color: "#2E6CF6", layer: "foreground" },
  { color: "#45C35A", layer: "foreground" },
  { color: "#B58A63", layer: "mid" },
  { color: "#8B5CF6", layer: "mid" },
  { color: "#45C35A", layer: "far" },
  { color: "#E5383B", layer: "far" },
];
