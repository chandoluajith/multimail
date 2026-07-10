const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src', 'components');

const regexMappings = [
  // Backgrounds with opacities that missed
  [/bg-slate-950\/[0-9]+/g, 'theme-bg-surface-alt'],
  [/bg-slate-900\/[0-9]+/g, 'theme-bg-surface-alt'],
  [/bg-slate-800\/[0-9]+/g, 'theme-bg-surface-alt'],
  [/bg-slate-700\/[0-9]+/g, 'theme-bg-surface-alt'],
  [/bg-slate-600\/[0-9]+/g, 'theme-bg-surface-alt'],
  [/bg-slate-500\/[0-9]+/g, 'theme-bg-surface-alt'],
  
  // Solid Backgrounds
  [/bg-slate-750/g, 'theme-bg-hover'],
  [/bg-slate-[0-9]+/g, 'theme-bg-tertiary'],

  // Borders
  [/border-slate-[0-9]+\/[0-9]+/g, 'theme-border-subtle'],
  [/border-slate-[0-9]+/g, 'theme-border-secondary'],

  // Placeholders
  [/placeholder-slate-[0-9]+/g, 'placeholder:text-slate-400 dark:placeholder:text-slate-500'],

  // Text colors
  [/text-slate-650/g, 'theme-text-muted'],
  [/text-slate-[0-9]+/g, 'theme-text-secondary'],

  // Gradients
  [/from-slate-[0-9]+\/[0-9]+/g, 'theme-bg-surface-alt'],
  [/to-slate-[0-9]+\/[0-9]+/g, ''], // Just remove 'to-slate' since background replaces it
];

function processDirectory(directory) {
  const files = fs.readdirSync(directory);
  
  for (const file of files) {
    const fullPath = path.join(directory, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let originalContent = content;
      
      // Specifically fix toggle buttons if they have hardcoded classes
      content = content.replace(/bg-slate-700 rounded-full peer-checked:bg-emerald-500/g, 'bg-slate-300 dark:bg-slate-700 rounded-full peer-checked:bg-emerald-500');
      
      // We don't want to replace text-white blindly, but we can replace it in certain spots
      // Let's rely on regex mappings
      for (const [regex, replacement] of regexMappings) {
        content = content.replace(regex, replacement);
      }
      
      // Clean up multiple spaces that might result from replacing with empty string
      content = content.replace(/ +/g, ' ');

      if (content !== originalContent) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

processDirectory(dir);
console.log('Done additional cleanup!');
