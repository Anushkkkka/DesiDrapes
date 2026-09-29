import path from 'node:path';
import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// One .env at the repo root serves Docker Compose, the API and the Prisma CLI.
// Real environment variables (Docker, CI) always win over file values.
config({ path: [path.resolve('.env'), path.resolve('../.env')], quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
});
