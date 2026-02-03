import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { scripts } from '../scripts.config';

const [scriptName, bumpType] = process.argv.slice(2);

if (!scriptName || !bumpType) {
  console.error('Usage: npm run release <script-name> <patch|minor|major>');
  console.error(`Available scripts: ${Object.keys(scripts).join(', ')}`);
  process.exit(1);
}

if (!['patch', 'minor', 'major'].includes(bumpType)) {
  console.error(`Invalid bump type: "${bumpType}". Use patch, minor, or major.`);
  process.exit(1);
}

const config = scripts[scriptName];
if (!config) {
  console.error(`Unknown script: "${scriptName}". Available: ${Object.keys(scripts).join(', ')}`);
  process.exit(1);
}

const currentVersion = config.userscript.version;
const [major, minor, patch] = currentVersion.split('.').map(Number);

let newVersion: string;
switch (bumpType) {
  case 'major': newVersion = `${major + 1}.0.0`; break;
  case 'minor': newVersion = `${major}.${minor + 1}.0`; break;
  case 'patch': newVersion = `${major}.${minor}.${patch + 1}`; break;
  default: throw new Error('unreachable');
}

console.log(`📦 ${scriptName}: ${currentVersion} → ${newVersion}`);

// Update version in scripts.config.ts
const configPath = 'scripts.config.ts';
const configContent = readFileSync(configPath, 'utf-8');

// Find the script block and replace its version
// Strategy: find the script key, then the next `version:` line within that block
const scriptKeyPattern = new RegExp(
  `('${scriptName}':\\s*\\{[\\s\\S]*?version:\\s*')${currentVersion.replace(/\./g, '\\.')}(')`
);

if (!scriptKeyPattern.test(configContent)) {
  console.error(`Could not find version "${currentVersion}" for script "${scriptName}" in ${configPath}`);
  process.exit(1);
}

const updatedConfig = configContent.replace(scriptKeyPattern, `$1${newVersion}$2`);
writeFileSync(configPath, updatedConfig, 'utf-8');
console.log(`✏️  Updated ${configPath}`);

// Build the specific script
console.log(`🔨 Building ${scriptName}...`);
execSync(`cross-env SCRIPT=${scriptName} npx vite build`, { stdio: 'inherit' });

// Stage files
execSync(`git add ${configPath} dist/${config.outputFileName}`, { stdio: 'inherit' });

// Commit
const commitMsg = `release: ${scriptName} v${newVersion}`;
execSync(`git commit -m "${commitMsg}"`, { stdio: 'inherit' });
console.log(`📝 Committed: ${commitMsg}`);

// Tag
const tagName = `${scriptName}/v${newVersion}`;
execSync(`git tag ${tagName}`, { stdio: 'inherit' });
console.log(`🏷️  Tagged: ${tagName}`);

console.log('');
console.log(`✅ Released ${scriptName} v${newVersion}`);
console.log(`   Push with: git push origin HEAD --tags`);
