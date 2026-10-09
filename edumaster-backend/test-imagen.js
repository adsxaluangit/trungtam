const { GoogleGenAI } = require('@google/genai');

const aiClient = new GoogleGenAI({
  apiKey: "GEMINI_API_KEY_REMOVED",
});

async function run() {
  try {
    const response = await aiClient.models.generateImages({
      model: 'imagen-3.0-generate-001',
      prompt: "A portrait of an Asian man in black suit",
      numberOfImages: 1,
      aspectRatio: "3:4"
    });
    console.log("Images generated:", response.generatedImages ? response.generatedImages.length : 0);
    if(response.generatedImages && response.generatedImages[0]) {
      console.log("Image type:", typeof response.generatedImages[0].image.imageBytes);
    }
  } catch (e) {
    console.error("ERROR 3.0:", e);
  }
}
run();
