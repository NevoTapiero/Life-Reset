// Gold bricks (LEGO-game milestones): the one list both Profile (the
// collection) and Home (the "you got one" toast) use.

import { legoLevel, photoOf } from "@/lib/brick";
import { rankForXp, type Profile } from "@/lib/game";

export type GoldBrick = { id: string; name: string; how: string; got: boolean; progress?: string };
export type GoldCounts = { done: number; friends?: number; apps?: number };

export function goldBricks(profile: Profile, n: GoldCounts): GoldBrick[] {
  const level = legoLevel(rankForXp(profile.xp).tierIndex);
  const best = Math.max(profile.streak_best, profile.streak_current);
  const friends = n.friends ?? 0;
  const apps = n.apps ?? 0;
  return [
    { id: "first", name: "First brick", how: "Check your first mission", got: n.done >= 1 },
    { id: "ten", name: "Ten bricks", how: "Check 10 missions", got: n.done >= 10, progress: `${Math.min(n.done, 10)}/10` },
    { id: "hundred", name: "Brick pile", how: "Check 100 missions", got: n.done >= 100, progress: `${Math.min(n.done, 100)}/100` },
    { id: "week", name: "One week", how: "A 7 day streak", got: best >= 7, progress: `${Math.min(best, 7)}/7` },
    { id: "fortnight", name: "Two weeks", how: "A 14 day streak", got: best >= 14, progress: `${Math.min(best, 14)}/14` },
    { id: "month", name: "A whole month", how: "A 30 day streak", got: best >= 30, progress: `${Math.min(best, 30)}/30` },
    { id: "xp1k", name: "1,000 XP", how: "Earn 1,000 XP", got: profile.xp >= 1000, progress: `${Math.min(profile.xp, 1000)}/1000` },
    { id: "xp5k", name: "5,000 XP", how: "Earn 5,000 XP", got: profile.xp >= 5000, progress: `${Math.min(profile.xp, 5000)}/5000` },
    { id: "lv3", name: "Level 3", how: "Reach LEGO level 3", got: level >= 3 },
    { id: "lv5", name: "Level 5", how: "Reach LEGO level 5, the full outfit", got: level >= 5 },
    { id: "friend", name: "Neighbour", how: "Add a friend to your town", got: friends >= 1 },
    { id: "town", name: "Full street", how: "Have 4 friends in your town", got: friends >= 4, progress: `${Math.min(friends, 4)}/4` },
    { id: "app", name: "Plugged in", how: "Connect an app that pays XP by itself", got: apps >= 1 },
    { id: "photo", name: "Say cheese", how: "Add your photo", got: !!photoOf(profile) },
  ];
}

// Which bricks this device already celebrated, per player.
const key = (uid: string) => `sl-gold-seen-${uid}`;
export function seenGold(uid: string): Set<string> | null {
  try {
    const raw = localStorage.getItem(key(uid));
    return raw ? new Set(JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}
export function saveSeenGold(uid: string, ids: Iterable<string>) {
  try {
    localStorage.setItem(key(uid), JSON.stringify([...ids]));
  } catch {}
}
