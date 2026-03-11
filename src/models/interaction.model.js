const { z } = require("zod");
const { InteractionType } = require("@prisma/client");

const interactionSchema = z.object({
  newsCardId: z.string().uuid(),
  type: z.nativeEnum(InteractionType),
  metadata: z.record(z.unknown()).optional(),
});

module.exports = { interactionSchema };
