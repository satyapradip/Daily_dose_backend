const { GoogleGenerativeAI } = require("@google/generative-ai");
const { env } = require("../../config/env");
const { logger } = require("../../utils/logger");

async function textToSpeech(text, voiceName = "Aoede") {
  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

  const model = genAI.getGenerativeModel({
    model: env.GEMINI_TTS_MODEL,
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    },
  });

  const result = await model.generateContent(text);
  const audioPart = result.response.candidates?.[0]?.content?.parts?.find((p) =>
    p.inlineData?.mimeType?.startsWith("audio/"),
  );

  if (!audioPart?.inlineData?.data) {
    throw new Error("No audio data returned from Gemini TTS");
  }

  return Buffer.from(audioPart.inlineData.data, "base64");
}

const voiceService = { textToSpeech };

module.exports = { voiceService };
