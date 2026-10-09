const nanoBananaKey = '3a61cbe2fd048770122d4362ff384717';
const recordInfoUrl = 'https://api.nanobananaapi.ai/api/v1/nanobanana/record-info';
const taskId = 'ebe208f9a3a3d4bc2533cc4def71431c';

async function run() {
  try {
    const statusRes = await fetch(`${recordInfoUrl}?taskId=${taskId}`, {
      headers: {
        'Authorization': `Bearer ${nanoBananaKey}`
      }
    });
    const statusData = await statusRes.json();
    console.log("Status:", JSON.stringify(statusData, null, 2));
  } catch(e) {
    console.error("Error:", e.message);
  }
}
run();
