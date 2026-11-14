/** Contract between the Worker and the app. Both sides import this file. */

export interface Person {
  /** The handle, as the export spells it. */
  username: string;
  /** The profile URL, straight from the export (or built from the handle). */
  href: string;
  /** When the relationship happened, as an ISO date, when the export has it. */
  since?: string;
}

export interface ReportExtras {
  blocked: Person[];
  closeFriends: Person[];
  pending: Person[];
  recentlyUnfollowed: Person[];
}

export interface Report {
  counts: {
    followers: number;
    following: number;
    notFollowingBack: number;
    youDontFollowBack: number;
    mutuals: number;
  };
  /** Who you follow that doesn't follow you back. */
  notFollowingBack: Person[];
  /** Who follows you that you don't follow back. */
  youDontFollowBack: Person[];
  /** Both ways. */
  mutuals: Person[];
  extras: ReportExtras;
  /** The files the ZIP actually had, by base name. */
  files: string[];
  /** Anything that kept the numbers from being exact. */
  warnings: string[];
  generatedAt: string;
}

export interface ApiError {
  error: string;
  hint?: string;
}

/* ---------- accounts and saved analyses ---------- */

export interface PublicUser {
  id: string;
  email: string;
  createdAt: string;
}

export interface SnapshotCounts {
  followers: number;
  following: number;
  notFollowingBack: number;
  youDontFollowBack: number;
  mutuals: number;
}

/** A saved analysis, without its lists: what the history lists. */
export interface SnapshotMeta {
  id: string;
  createdAt: string;
  counts: SnapshotCounts;
}

/** Two analyses, older to newer. */
export interface SnapshotDiff {
  from: SnapshotMeta;
  to: SnapshotMeta;
  newFollowers: Person[];
  lostFollowers: Person[];
  newFollowing: Person[];
  unfollowed: Person[];
}
