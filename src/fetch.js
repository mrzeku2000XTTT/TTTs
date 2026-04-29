const https = require('https');
https.get('https://raw.githubusercontent.com/heygen-com/website-to-hyperframes-demo/main/README.md', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => { console.log(data); });
}).on('error', (err) => {
  console.log("Error: " + err.message);
});
