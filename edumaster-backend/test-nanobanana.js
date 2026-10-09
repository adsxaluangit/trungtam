const nanoBananaKey = '3a61cbe2fd048770122d4362ff384717';
const generateUrl = 'https://api.nanobananaapi.ai/api/v1/nanobanana/generate';

async function test(urlList) {
  try {
    const apiRes = await fetch(generateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${nanoBananaKey}`
      },
      body: JSON.stringify({
        prompt: "Tạo một bức ảnh chân dung 3x4",
        type: "IMAGETOIAMGE",
        numImages: 1,
        imageUrls: urlList
      })
    });
    const data = await apiRes.json();
    console.log(`Test with urlList=${JSON.stringify(urlList)}:`, JSON.stringify(data));
  } catch(e) {
    console.error(`Error:`, e.message);
  }
}

async function run() {
  await test([]);
  await test(['']);
  await test(['https://catbox.moe']);
}
run();
