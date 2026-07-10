const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src', 'components');

const mappings = {
  // Backgrounds with opacities
  'bg-slate-950/40': 'theme-bg-surface-alt',
  'bg-slate-950/60': 'theme-bg-surface-alt',
  'bg-slate-950/80': 'theme-bg-overlay',
  'bg-slate-950/95': 'theme-bg-overlay',
  'bg-slate-900/10': 'theme-bg-surface-alt',
  'bg-slate-900/20': 'theme-bg-surface-alt',
  'bg-slate-900/30': 'theme-bg-surface-alt',
  'bg-slate-900/40': 'theme-bg-surface-alt',
  'bg-slate-900/50': 'theme-bg-surface-alt',
  'bg-slate-900/60': 'theme-bg-surface-alt',
  'bg-slate-900/80': 'theme-bg-overlay',
  
  // Solid Backgrounds
  'bg-slate-950': 'theme-bg-primary',
  'bg-slate-900': 'theme-bg-secondary',
  'bg-slate-850': 'theme-bg-hover',
  'hover:bg-slate-850': 'theme-bg-hover',
  'bg-slate-800': 'theme-bg-tertiary',
  'hover:bg-slate-800': 'theme-bg-hover',
  'hover:bg-slate-900': 'theme-bg-hover',

  // Borders
  'border-slate-800/30': 'theme-border-subtle',
  'border-slate-800/40': 'theme-border-subtle',
  'border-slate-800/60': 'theme-border-subtle',
  'border-slate-800/80': 'theme-border-subtle',
  'border-slate-950': 'theme-border',
  'border-slate-900': 'theme-border',
  'border-slate-800': 'theme-border',
  'border-slate-700': 'theme-border-secondary',
  'border-slate-600': 'theme-border-secondary',
  'border-slate-500': 'theme-border-subtle',

  // Text
  'text-slate-100': 'theme-text-primary',
  'text-slate-200': 'theme-text-primary',
  'text-slate-300': 'theme-text-secondary',
  'text-slate-400': 'theme-text-secondary',
  'text-slate-500': 'theme-text-muted',
  'text-slate-600': 'theme-text-muted',
  'text-slate-700': 'theme-text-muted',
  
  // Hover Text
  'hover:text-slate-200': 'theme-text-primary',
  'hover:text-slate-300': 'theme-text-secondary',
  'hover:text-slate-400': 'theme-text-secondary',

  // Shadows
  'shadow-lg': 'theme-shadow-lg',
  'shadow-md': 'theme-shadow-md',
  'shadow-sm': 'theme-shadow-sm',
  'shadow-xl': 'theme-shadow-xl'
};

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
      
      // We want to replace whole words only to avoid replacing bg-slate-900 inside bg-slate-900/40
      // So we will sort the keys by length descending to match longest first
      const sortedKeys = Object.keys(mappings).sort((a, b) => b.length - a.length);
      
      for (const key of sortedKeys) {
        // Create regex with word boundaries, except that "/" and "-" aren't simple word boundaries in JS regex
        // We can just do a split and join or a more robust regex.
        // A simple global replace using lookaheads/lookbehinds for boundaries
        const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // The negative lookahead/behind ensures we don't match a partial class
        const regex = new RegExp(`(?<![\\w-])${escapedKey}(?![\\w-/])`, 'g');
        content = content.replace(regex, mappings[key]);
      }
      
      if (content !== originalContent) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

processDirectory(dir);
console.log('Done!');
