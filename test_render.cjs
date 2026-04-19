const fs = require('fs/promises');

async function testRender() {
  const html = `<!DOCTYPE html><html><body><h1>Test</h1></body></html>`;
  try {
    const res = await fetch('http://localhost:3000/api/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html })
    });
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Full text:", text);
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

testRender();
