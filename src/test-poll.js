async function run() {
  const res = await fetch("https://image.pollinations.ai/prompt/a%20sleek%20sports%20car%20in%20neon%20city?width=1920&height=1080&nologo=true", { method: 'HEAD' });
  console.log(res.status, res.headers.get("content-type"));
}
run();
