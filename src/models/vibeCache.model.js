const { z } = require("zod");

const vibeContentSchema = z.object({
  cardId: z.string().uuid(),
  vibe: z.enum(["SARCASTIC", "DRAMATIC", "CONSPIRACY", "AUNTY"]),
});

module.exports = { vibeContentSchema };
