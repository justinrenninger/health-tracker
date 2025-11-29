'use client';

import { init } from '@instantdb/react';
import schema, { type AppSchema } from '@/instant.schema';

const APP_ID = process.env.NEXT_PUBLIC_INSTANT_APP_ID;

if (!APP_ID) {
  throw new Error(
    'NEXT_PUBLIC_INSTANT_APP_ID is missing. Add it to .env.local before using InstantDB.',
  );
}

export const db = init({
  appId: APP_ID,
  schema,
});

export type { AppSchema };

