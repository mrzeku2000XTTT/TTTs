const response = await fetch('https://raw.githubusercontent.com/heygen-com/website-to-hyperframes-demo/main/README.md');
const text = await response.text();
console.log(text);
