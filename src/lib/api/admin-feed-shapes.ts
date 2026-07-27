import { z } from "zod";

const zAdminContactSubmission = z.strictObject({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string(),
  subject: z.string(),
  message: z.string(),
  ipAddress: z.string().nullable(),
  status: z.enum(["new", "read", "archived"]),
  createdAt: z.date(),
});

const zAdminContactFeed = z.strictObject({
  submissions: z.array(zAdminContactSubmission),
  limit: z.number().int().min(1).max(200),
  offset: z.number().int().min(0),
});

const zAdminAdvisoryApplication = z.strictObject({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string(),
  institution: z.string(),
  role: z.string(),
  expertiseArea: z.string(),
  experience: z.string(),
  links: z.string().nullable(),
  cvUrl: z.string().nullable(),
  status: z.enum(["new", "reviewed", "contacted", "archived"]),
  createdAt: z.date(),
});

const zAdminAdvisoryFeed = z.strictObject({
  applications: z.array(zAdminAdvisoryApplication),
  limit: z.number().int().min(1).max(200),
  offset: z.number().int().min(0),
  status: z.enum(["new", "reviewed", "contacted", "archived"]).optional(),
});

export function shapeAdminContactFeed(
  input: unknown,
): z.output<typeof zAdminContactFeed> {
  return zAdminContactFeed.parse(input);
}

export function shapeAdminAdvisoryFeed(
  input: unknown,
): z.output<typeof zAdminAdvisoryFeed> {
  return zAdminAdvisoryFeed.parse(input);
}

export const ADMIN_FEED_RESPONSE_SCHEMAS = Object.freeze({
  contact: zAdminContactFeed,
  advisory: zAdminAdvisoryFeed,
});
