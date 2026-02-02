import { execSync } from 'child_process';
import { scripts } from './scripts.config';

const filter = process.argv[2];

for (const [name] of Object.entries(scripts)) {
  if (filter && name !== filter) continue;
  console.log(`\n📦 Building ${name}...`);
  execSync(`cross-env SCRIPT=${name} npx vite build`, { stdio: 'inherit', cwd: process.cwd() });
  console.log(`✅ ${name} built successfully`);
}

console.log('\n🎉 All scripts built!');
