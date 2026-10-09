const { GoogleGenAI } = require('@google/genai');

const aiClient = new GoogleGenAI({
  apiKey: "GEMINI_API_KEY_REMOVED",
});

async function run() {
  try {
    const dummyBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="; // 1x1 red pixel
    
    // First try generateContent with 3.1
    console.log("Trying generateContent with gemini-3.1-flash-image...");
    try {
      const response = await aiClient.models.generateContent({
        model: 'gemini-3.1-flash-image',
        contents: {
          parts: [
            { inlineData: { data: dummyBase64, mimeType: "image/png" } },
            { text: "Tạo một bức ảnh chân dung người đàn ông mặc áo vest đen, phông nền trắng, tỷ lệ 3x4." },
          ],
        },
      });
      console.log("SUCCESS with generateContent!", !!response.candidates?.[0]?.content?.parts?.[0]?.inlineData);
    } catch(e) {
      console.error("FAIL with generateContent:", e.message);
    }

  } catch (e) {
    console.error("FATAL ERROR:", e);
  }
}
run();
