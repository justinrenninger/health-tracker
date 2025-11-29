// Docs: https://www.instantdb.com/docs/permissions

import type { InstantRules } from "@instantdb/react";

const ownerGuard = {
  allow: {
    view: "isOwner",
    create: "isOwner",
    update: "isOwner",
    delete: "isOwner",
  },
};

const rules = {
  users: {
    ...ownerGuard,
    bind: ["isOwner", "auth.id != null && auth.id == data.authId"],
  },
  dailyMetrics: {
    ...ownerGuard,
    bind: ["isOwner", "auth.id != null && auth.id == data.userId"],
  },
  targets: {
    ...ownerGuard,
    bind: ["isOwner", "auth.id != null && auth.id == data.userId"],
  },
  goals: {
    ...ownerGuard,
    bind: ["isOwner", "auth.id != null && auth.id == data.userId"],
  },
  notifications: {
    ...ownerGuard,
    bind: ["isOwner", "auth.id != null && auth.id == data.userId"],
  },
} satisfies InstantRules;

export default rules;
