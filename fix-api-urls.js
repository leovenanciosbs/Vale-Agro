const fs = require('fs');
const path = require('path');
const base = 'https://vale-agro-alpha.vercel.app';
const root = path.join(__dirname, 'frontend', 'js');
const files = [];

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, name);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith('.js')) {
      files.push(fullPath);
    }
  }
}

walk(root);
let patched = 0;
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes(base)) {
    const updated = content.split(base).join('');
    fs.writeFileSync(file, updated, 'utf8');
    console.log('patched', file);
    patched++;
  }
}
console.log('total patched files:', patched);
