const fs = require('fs');
const path = require('path');

const modulesDir = path.join(__dirname, 'modules');

const replacements = [
  { regex: /text-slate-[89]00/g, replacement: 'text-chrome-100' },
  { regex: /text-slate-[67]00/g, replacement: 'text-chrome-200' },
  { regex: /text-slate-500/g, replacement: 'text-chrome-400' },
  { regex: /text-slate-[34]00/g, replacement: 'text-chrome-500' },
  { regex: /bg-white/g, replacement: 'bg-metal-mid' },
  { regex: /bg-slate-50/g, replacement: 'bg-metal-dark' },
  { regex: /bg-slate-100/g, replacement: 'bg-metal-mid' },
  { regex: /border-slate-[123]00/g, replacement: 'border-metal-border' },
  { regex: /bg-blue-100 text-blue-700/g, replacement: 'bg-blue-500/15 text-blue-400' },
  { regex: /bg-emerald-100 text-emerald-700/g, replacement: 'bg-emerald-500/15 text-emerald-400' },
  { regex: /bg-purple-100 text-purple-700/g, replacement: 'bg-purple-500/15 text-purple-400' },
  { regex: /bg-amber-100 text-amber-700/g, replacement: 'bg-amber-500/15 text-amber-400' },
  { regex: /bg-red-100 text-red-700/g, replacement: 'bg-red-500/15 text-red-400' },
  { regex: /bg-green-100 text-green-700/g, replacement: 'bg-green-500/15 text-green-400' },
  { regex: /hover:bg-slate-50/g, replacement: 'hover:bg-white/3' },
  { regex: /hover:bg-slate-100/g, replacement: 'hover:bg-white/5' },
  { regex: /bg-slate-900 text-white/g, replacement: 'btn-chrome' },
  { regex: /bg-blue-600 text-white/g, replacement: 'btn-chrome' },
  { regex: /focus:ring-blue-50/g, replacement: 'focus:ring-blue-500/15' },
  { regex: /shadow-slate-[12]00/g, replacement: 'shadow-metal-border' },
  { regex: /rounded-\[2\.5rem\]/g, replacement: 'rounded-2xl' },
  { regex: /rounded-\[3rem\]/g, replacement: 'rounded-2xl' }
];

fs.readdirSync(modulesDir).forEach(file => {
  if (file.endsWith('.tsx') && file !== 'UserManagement.tsx') {
    const filePath = path.join(modulesDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    replacements.forEach(rule => {
      content = content.replace(rule.regex, rule.replacement);
    });
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
