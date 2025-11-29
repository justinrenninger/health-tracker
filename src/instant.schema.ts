// Docs: https://www.instantdb.com/docs/modeling-data

import { i } from "@instantdb/react";

const _schema = i.schema({
  entities: {
    $files: i.entity({
      path: i.string().unique().indexed(),
      url: i.string(),
    }),
    $users: i.entity({
      email: i.string().unique().indexed().optional(),
      imageURL: i.string().optional(),
      type: i.string().optional(),
    }),
    users: i.entity({
      authId: i.string().unique().indexed(),
      displayName: i.string().optional(),
      email: i.string().optional(),
      weightGoal: i.number().optional(),
      reminderTimes: i.json().optional(),
      integrationTokens: i.json().optional(),
    }),
    dailyMetrics: i.entity({
      userId: i.string().indexed(),
      date: i.date().indexed(),
      entryKey: i.string().unique().indexed().optional(),
      steps: i.number().optional(),
      calories: i.number().optional(),
      protein: i.number().optional(),
      workoutMinutes: i.number().optional(),
      weight: i.number().optional(),
      source: i.string().optional(),
      manual: i.boolean().optional(),
      notes: i.string().optional(),
    }),
    targets: i.entity({
      userId: i.string().indexed(),
      effectiveDate: i.date().optional(),
      steps: i.number().optional(),
      calories: i.number().optional(),
      protein: i.number().optional(),
      workoutsPerDay: i.number().optional(),
    }),
    goals: i.entity({
      userId: i.string().indexed(),
      goalType: i.string().indexed(),
      targetValue: i.number(),
      targetDate: i.date().optional(),
    }),
    notifications: i.entity({
      userId: i.string().indexed(),
      type: i.string().indexed(),
      channel: i.string().optional(),
      scheduledAt: i.date().indexed(),
      status: i.string().optional(),
      payload: i.json().optional(),
    }),
  },
  links: {
    $usersLinkedPrimaryUser: {
      forward: {
        on: "$users",
        has: "one",
        label: "linkedPrimaryUser",
        onDelete: "cascade",
      },
      reverse: {
        on: "$users",
        has: "many",
        label: "linkedGuestUsers",
      },
    },
  },
  rooms: {},
});

// This helps Typescript display nicer intellisense
type AppSchema = typeof _schema;
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;
