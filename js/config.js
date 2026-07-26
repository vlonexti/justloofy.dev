// ============================================================
// Site configuration
//
// The site runs in DEMO MODE (sample products, no accounts)
// until you fill in your Supabase project details below.
// Full setup instructions are in README.md.
// ============================================================

export const CONFIG = {
  // From Supabase dashboard → Project Settings → API
  SUPABASE_URL: "https://dxirnxrybmntzipvahem.supabase.co",      // e.g. "https://abcdefgh.supabase.co"
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4aXJueHJ5Ym1udHppcHZhaGVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3ODAxMjgsImV4cCI6MjEwMDM1NjEyOH0.Zr8BPcYmpFQWbbwFP22cTsUN_sU-ghXfLXWGOS3Hf38", // the long "anon / public" key (safe to expose in frontend)

  // ---- Branding -------------------------------------------------
  // Change these three lines and the name updates everywhere:
  // header, footer, every page title, and the checkout receipts.
  SITE_NAME: "0o777",
  BRAND: { lead: "0o", accent: "777" },   // the logo is drawn as lead + accent
  SITE_TAGLINE: "Mods, Accounts & Subscriptions",

  SITE_URL: "https://justloofy.dev",

  // Socials shown in the header and footer
  DISCORD_URL: "https://discord.gg/bKPQ6JzbEn",
  YOUTUBE_URL: "https://www.youtube.com/@itsreallyme08",
  GITHUB_URL: "https://github.com/vlonexti",
};
