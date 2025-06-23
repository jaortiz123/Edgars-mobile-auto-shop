// debug-utils.js
const fs = require('fs');
const path = require('path');

class DebugTracker {
  constructor() {
    this.session = new Date().toISOString();
    this.issues = [];
    this.logsDir = 'debug-logs';
    
    // Create logs directory if it doesn't exist
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  logIssue(issue) {
    const entry = {
      id: this.issues.length + 1,
      timestamp: new Date().toISOString(),
      ...issue
    };
    this.issues.push(entry);
    this.saveToFile();
    console.log(`🐛 Issue #${entry.id}: ${entry.title} [${entry.severity}]`);
  }

  updateIssue(id, updates) {
    const issue = this.issues.find(i => i.id === id);
    if (issue) {
      Object.assign(issue, updates);
      this.saveToFile();
      console.log(`✅ Updated Issue #${id}: ${updates.status || 'Updated'}`);
    }
  }

  saveToFile() {
    const filename = `session-${this.session.slice(0, 19).replace(/:/g, '-')}.json`;
    fs.writeFileSync(
      path.join(this.logsDir, filename),
      JSON.stringify(this.issues, null, 2)
    );
  }

  generateReport() {
    const critical = this.issues.filter(i => i.severity === 'Critical');
    const high = this.issues.filter(i => i.severity === 'High');
    const medium = this.issues.filter(i => i.severity === 'Medium');
    const low = this.issues.filter(i => i.severity === 'Low');

    console.log('\n📊 DEBUG REPORT:');
    console.log(`Critical: ${critical.length} | High: ${high.length} | Medium: ${medium.length} | Low: ${low.length}`);
    
    return {
      summary: { critical: critical.length, high: high.length, medium: medium.length, low: low.length },
      issues: this.issues
    };
  }
}

// CSS Diagnostic Functions
const CSSDebugger = {
  async checkPostCSSConfig() {
    try {
      const configPath = './frontend/postcss.config.cjs';
      const config = require(configPath);
      
      // Check for common issues
      const issues = [];
      
      if (config.plugins && config.plugins.tailwindcss) {
        issues.push('Using legacy tailwindcss plugin syntax');
      }
      
      if (!config.plugins || !config.plugins['@tailwindcss/postcss']) {
        issues.push('Missing @tailwindcss/postcss plugin');
      }
      
      return { valid: issues.length === 0, issues };
    } catch (error) {
      return { valid: false, issues: [`Config file error: ${error.message}`] };
    }
  },

  async checkTailwindConfig() {
    try {
      const configPath = './frontend/tailwind.config.js';
      const exists = fs.existsSync(configPath);
      
      if (!exists) return { valid: false, issues: ['Tailwind config not found'] };
      
      const content = fs.readFileSync(configPath, 'utf8');
      const issues = [];
      
      if (!content.includes('content:')) {
        issues.push('Missing content configuration');
      }
      
      return { valid: issues.length === 0, issues };
    } catch (error) {
      return { valid: false, issues: [`Config error: ${error.message}`] };
    }
  },

  async checkCSSFiles() {
    const cssFiles = [
      './frontend/src/index.css',
      './frontend/src/index-new.css'
    ];
    
    const existing = cssFiles.filter(file => fs.existsSync(file));
    const issues = [];
    
    if (existing.length > 1) {
      issues.push('Multiple CSS entry files detected - may cause conflicts');
    }
    
    if (existing.length === 0) {
      issues.push('No CSS entry file found');
    }
    
    return { 
      valid: existing.length === 1, 
      issues,
      files: existing 
    };
  }
};

module.exports = { DebugTracker, CSSDebugger };
