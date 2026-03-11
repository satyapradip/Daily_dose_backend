const { z } = require("zod");
const { Category, InteractionType } = require("@prisma/client");

const feedQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

const categoryParamSchema = z.object({
  category: z.nativeEnum(Category),
});

const interactionSchema = z.object({
  newsCardId: z.string().uuid(),
  type: z.nativeEnum(InteractionType),
  metadata: z.record(z.unknown()).optional(),
});

module.exports = { feedQuerySchema, categoryParamSchema, interactionSchema };
