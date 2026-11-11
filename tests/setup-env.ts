process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://ci:ci@localhost:5432/ci';
process.env.AUTH_SECRET =
  process.env.AUTH_SECRET || 'dev-only-secret-change-me-in-production-0123456789abcdef';
