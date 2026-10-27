-- MembershipRole has carried PARENT in the Prisma schema and in the role tables
-- for a while, but the database enum was never extended. Any attempt to create
-- a parent membership failed with 22P02 before the application code ran.
ALTER TYPE "MembershipRole" ADD VALUE IF NOT EXISTS 'PARENT';
