import { build } from '../engine/node_modules/esbuild/lib/main.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await build({ absWorkingDir: root, entryPoints: ['frontend/shared/activity-resources/source.js'], outfile: 'frontend/shared/activity-resources/browser.js', bundle:true, minify:true, format:'iife', target:['es2020'], loader:{'.woff2':'file','.woff':'file','.ttf':'file'}, assetNames:'fonts/[name]-[hash]' });
console.log('Recursos matemáticos e visuais locais preparados.');
