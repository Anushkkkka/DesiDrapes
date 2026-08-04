# Database setup

## Local PostgreSQL

Install and run PostgreSQL locally, then create a database named `desidrapes`.

Example:

```bash
createdb desidrapes
```

Then run:

```bash
$env:DATABASE_URL='postgresql://postgres:postgres@localhost:5432/desidrapes'
npx prisma migrate dev --name init
```

## Docker-based setup

If Docker is available, run:

```bash
docker compose up -d db
```
