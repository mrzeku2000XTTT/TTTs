async function test() {
  const targetUrl = 'https://apple.com';
  const url = `https://api.microlink.io?url=${encodeURIComponent(targetUrl)}&screenshot=true&waitForTimeout=3000&meta=false`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log(data);
  } catch(e) {
    console.error(e);
  }
}
test();
