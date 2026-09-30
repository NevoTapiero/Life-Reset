// Small UI facts for the brick-themed screens (Home, World, Profile). Game
// rules stay in game.ts; this file only says how things look.

import type { Pillar } from "@/lib/game";

// each pillar wears one LEGO brick colour (CSS tokens from globals.css)
export const PILLAR_BRICK: Record<Pillar | string, string> = {
  Strength: "var(--lego-red)",
  Focus: "var(--lego-azure)",
  Constitution: "var(--lego-green)",
  Discipline: "var(--lego-blue)",
  Wisdom: "var(--lego-orange)",
};

// The minifig's title at each LEGO level (level = rank tier + 1, 1 to 5),
// the same titles as the loadouts the 3D world dresses them in.
const LEVEL_TITLES: Record<string, string[]> = {
  warrior: ["Recruit", "Fighter", "Warrior", "Knight", "Champion"],
  mentalist: ["Novice", "Seeker", "Mind Reader", "Oracle", "Mastermind"],
  wizard: ["Apprentice", "Scholar", "Mage", "Archmage", "Sage"],
  guardian: ["Keeper", "Ranger", "Sentinel", "Warden", "Aegis"],
  shadow: ["Initiate", "Stalker", "Phantom", "Reaper", "Sovereign"],
};

export const MAX_LEGO_LEVEL = 5;

export function legoLevel(tierIndex: number): number {
  return Math.min(MAX_LEGO_LEVEL, Math.max(1, tierIndex + 1));
}

export function levelTitle(character: string | null | undefined, tierIndex: number): string {
  const titles = LEVEL_TITLES[character ?? "warrior"] ?? LEVEL_TITLES.warrior;
  return titles[legoLevel(tierIndex) - 1];
}

// "Good morning" by the hour of the app day
// bedtime in Israel: minifigs doze on Home
export function sleepyHour(d = new Date()): boolean {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Jerusalem" }).format(d));
  return h >= 23 || h < 5;
}

export function greeting(d = new Date()): string {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Jerusalem" }).format(d));
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Good night";
}

// A player's uploaded picture, when the profile has one (the avatar_url column
// is added by the profile-photo migration; older rows simply don't have it).
export function photoOf(p: object | null | undefined): string | null {
  const url = (p as { avatar_url?: string | null } | null)?.avatar_url;
  return typeof url === "string" && url ? url : null;
}
