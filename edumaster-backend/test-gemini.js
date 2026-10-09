const { GoogleGenAI } = require('@google/genai');

const aiClient = new GoogleGenAI({
  apiKey: "GEMINI_API_KEY_REMOVED",
});

async function run() {
  try {
    const response = await aiClient.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          { text: "Tạo một bức ảnh chân dung người đàn ông mặc áo vest đen, phông nền trắng, tỷ lệ 3x4." },
        ],
      },
      config: {
        responseMimeType: 'image/png'
      }
    });
    console.log(JSON.stringify(response, null, 2));
  } catch (e) {
    console.error("ERROR:", e);
  }
}
run();
