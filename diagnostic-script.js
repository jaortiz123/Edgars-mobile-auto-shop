#!/usr/bin/env node

const { DebugTracker, CSSDebugger } = require('./debug-utils.js');
const fs = require('fs');
const { execSync } = require('child_process');

const tracker = new DebugTracker();

async function runDiagnostics() {
  console.log('🔍 Starting CSS Diagnostics...\n');

  // Issue #1: PostCSS Configuration
  console.log('1️⃣ Checking PostCSS Configuration...');
  const postcssCheck = await CSSDebugger.checkPostCSSConfig();
  tracker.logIssue({
    title: 'PostCSS Plugin Configuration',
    severity: 'Critical',
    status: postcssCheck.valid ? 'Fixed' : 'Failed',
    details: postcssCheck.issues,
    testResult: postcssCheck
  });

  // Issue #2: Tailwind Configuration  
  console.log('2️⃣ Checking Tailwind Configuration...');
  const tailwindCheck = await CSSDebugger.checkTailwindConfig();
  tracker.logIssue({
    title: 'Tailwind Configuration',
    severity: 'High', 
    status: tailwindCheck.valid ? 'Fixed' : 'Failed',
    details: tailwindCheck.issues,
    testResult: tailwindCheck
  });

  // Issue #3: CSS Files Check
  console.log('3️⃣ Checking CSS Files...');
  const cssCheck = await CSSDebugger.checkCSSFiles();
  tracker.logIssue({
    title: 'CSS Files Conflict',
    severity: 'Medium',
    status: cssCheck.valid ? 'Fixed' : 'Failed', 
    details: cssCheck.issues,
    testResult: cssCheck
  });

  // Issue #4: Package Dependencies
  console.log('4️⃣ Checking Package Dependencies...');
  try {
    const packageJson = JSON.parse(fs.readFileSync('./frontend/package.json', 'utf8'));
    const hasTailwind = packageJson.devDependencies?.['@tailwindcss/cli'] || 
                       packageJson.devDependencies?.['tailwindcss'];
    const hasPostCSS = packageJson.devDependencies?.['postcss'];
    
    tracker.logIssue({
      title: 'Package Dependencies',
      severity: 'High',
      status: (hasTailwind && hasPostCSS) ? 'Fixed' : 'Failed',
      details: [
        `Tailwind: ${hasTailwind ? '✅' : '❌'}`,
        `PostCSS: ${hasPostCSS ? '✅' : '❌'}`
      ]
    });
  } catch (error) {
    tracker.logIssue({
      title: 'Package Dependencies',
      severity: 'High', 
      status: 'Failed',
      details: [error.message]
    });
  }

  // Issue #5: Vite Configuration
  console.log('5️⃣ Checking Vite Configuration...');
  try {
    const viteConfigExists = fs.existsSync('./frontend/vite.config.ts');
    tracker.logIssue({
      title: 'Vite Configuration',
      severity: 'Medium',
      status: viteConfigExists ? 'Fixed' : 'Failed',
      details: viteConfigExists ? ['Vite config exists'] : ['Vite config missing']
    });
  } catch (error) {
    tracker.logIssue({
      title: 'Vite Configuration',
      severity: 'Medium',
      status: 'Failed',
      details: [error.message]
    });
  }

  // Generate final report
  console.log('\n📊 DIAGNOSTIC COMPLETE');
  const report = tracker.generateReport();
  
  // Save detailed report
  fs.writeFileSync('./diagnostic-report.json', JSON.stringify(report, null, 2));
  console.log('📄 Detailed report saved to diagnostic-report.json');

  return report;
}

// Run diagnostics
runDiagnostics().catch(console.error);
