const { GoogleGenAI } = require('@google/genai');

const aiClient = new GoogleGenAI({
  apiKey: "GEMINI_API_KEY_REMOVED",
});

async function run() {
  try {
    const dummyBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="; // 1x1 red pixel
    const response = await aiClient.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          { inlineData: { data: dummyBase64, mimeType: "image/png" } },
          { text: "Tạo một bức ảnh chân dung người đàn ông mặc áo vest đen, phông nền trắng, tỷ lệ 3x4." },
        ],
      },
    });
    console.log(JSON.stringify(response, null, 2));
  } catch (e) {
    console.error("ERROR WITH IMAGE INPUT:", e);
  }
}
run();
