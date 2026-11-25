/**
 * Avaluatron Institutional Layer Test Suite
 * 
 * This test suite validates the institutional layer functionality
 * in both local and cloud modes.
 * 
 * To run:
 *   1. Start the development server: python3 server.py
 *   2. Open browser console at http://localhost:3000
 *   3. Copy-paste test functions and run them
 *   4. Or load this file: <script src="tests/institutional.test.js"></script>
 */

// Test utilities
const TEST_UTILS = {
  colors: {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
  },

  log: function(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = {
      info: `[${timestamp}] ℹ️`,
      success: `[${timestamp}] ✅`,
      error: `[${timestamp}] ❌`,
      warning: `[${timestamp}] ⚠️`,
      test: `[${timestamp}] 🧪`
    }[type] || `[${timestamp}]`;

    console.log(`${prefix} ${message}`);
  },

  assert: function(condition, message) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  },

  assertEqual: function(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(
        `${message}\n  Expected: ${JSON.stringify(expected)}\n  Actual: ${JSON.stringify(actual)}`
      );
    }
  },

  assertExists: function(value, message) {
    if (value === undefined || value === null) {
      throw new Error(`${message} - value does not exist`);
    }
  }
};

// Test Suite 1: Local Storage Tests
const TEST_SUITE_LOCAL_STORAGE = {
  name: 'Local Storage & Data Persistence',
  
  async testDataPersistence() {
    TEST_UTILS.log('Testing local storage data persistence...', 'test');
    
    // Check if local storage is available
    TEST_UTILS.assertExists(window.localStorage, 'LocalStorage not available');
    
    // Check if data storage key exists
    const storageKey = 'avaluatro.data.v1';
    const storedData = localStorage.getItem(storageKey);
    TEST_UTILS.assertExists(storedData, 'No stored data found');
    
    // Parse and validate JSON
    let data;
    try {
      data = JSON.parse(storedData);
    } catch (e) {
      throw new Error(`Invalid JSON in localStorage: ${e.message}`);
    }
    
    TEST_UTILS.log('✓ Data is valid JSON', 'success');
    return data;
  },

  async testDataSchema() {
    TEST_UTILS.log('Testing data schema...', 'test');
    
    const data = await this.testDataPersistence();
    
    // Check required fields
    const requiredFields = [
      'schemaVersion',
      'students',
      'classGroups',
      'competencies',
      'activities',
      'subjects',
      'dailyAssessments',
      'assessments'
    ];
    
    for (const field of requiredFields) {
      TEST_UTILS.assertExists(data[field], `Missing required field: ${field}`);
    }
    
    // Verify types
    TEST_UTILS.assertEqual(typeof data.schemaVersion, 'number', 'schemaVersion should be number');
    TEST_UTILS.assert(Array.isArray(data.students), 'students should be array');
    TEST_UTILS.assert(Array.isArray(data.classGroups), 'classGroups should be array');
    
    TEST_UTILS.log('✓ Data schema is valid', 'success');
    return data;
  },

  async testDataModification() {
    TEST_UTILS.log('Testing data modification and reload...', 'test');
    
    const storageKey = 'avaluatro.data.v1';
    const originalData = JSON.parse(localStorage.getItem(storageKey));
    
    // Modify data
    const testData = { ...originalData, _testMarker: `test-${Date.now()}` };
    localStorage.setItem(storageKey, JSON.stringify(testData));
    
    // Verify modification
    const reloadedData = JSON.parse(localStorage.getItem(storageKey));
    TEST_UTILS.assertEqual(reloadedData._testMarker, testData._testMarker, 'Data not persisted correctly');
    
    // Restore original
    localStorage.setItem(storageKey, JSON.stringify(originalData));
    
    TEST_UTILS.log('✓ Data modification works correctly', 'success');
  }
};

// Test Suite 2: Institutional Files Tests
const TEST_SUITE_INSTITUTIONAL_FILES = {
  name: 'Institutional Layer Files',

  async testFilesExist() {
    TEST_UTILS.log('Checking institutional layer files...', 'test');
    
    const files = [
      'js/institutional.js',
      'js/institutional-ui.js',
      'styles-institutional.css',
      'INSTITUTIONAL_LAYER.md'
    ];
    
    for (const file of files) {
      try {
        const response = await fetch(file);
        if (!response.ok) {
          throw new Error(`File not found: ${response.status}`);
        }
        TEST_UTILS.log(`✓ ${file} exists`, 'success');
      } catch (e) {
        throw new Error(`Failed to load ${file}: ${e.message}`);
      }
    }
  },

  async testStylesLoaded() {
    TEST_UTILS.log('Checking institutional styles...', 'test');
    
    const styleSheets = Array.from(document.styleSheets);
    const hasInstitutionalStyles = styleSheets.some(sheet => 
      sheet.href && sheet.href.includes('styles-institutional.css')
    );
    
    if (!hasInstitutionalStyles) {
      TEST_UTILS.log('⚠️ Institutional styles not loaded yet', 'warning');
    } else {
      TEST_UTILS.log('✓ Institutional styles loaded', 'success');
    }
  }
};

// Test Suite 3: Browser Compatibility Tests
const TEST_SUITE_BROWSER_COMPATIBILITY = {
  name: 'Browser Compatibility',

  async testBrowserFeatures() {
    TEST_UTILS.log('Testing required browser features...', 'test');
    
    const features = {
      'LocalStorage': () => typeof window.localStorage !== 'undefined',
      'JSON support': () => typeof JSON !== 'undefined' && typeof JSON.parse === 'function',
      'Fetch API': () => typeof fetch === 'function',
      'Promise support': () => typeof Promise !== 'undefined',
      'ES6 Modules': () => typeof import !== 'undefined',
      'Template Literals': () => true, // If code runs, this works
    };
    
    const results = {};
    for (const [feature, test] of Object.entries(features)) {
      try {
        const supported = test();
        results[feature] = supported;
        const status = supported ? '✓' : '✗';
        const type = supported ? 'success' : 'error';
        TEST_UTILS.log(`${status} ${feature}`, type);
      } catch (e) {
        results[feature] = false;
        TEST_UTILS.log(`✗ ${feature}: ${e.message}`, 'error');
      }
    }
    
    return results;
  },

  async testBrowserInfo() {
    TEST_UTILS.log('Browser Information:', 'info');
    
    const info = {
      'User Agent': navigator.userAgent,
      'Platform': navigator.platform,
      'Language': navigator.language,
      'Cookies Enabled': navigator.cookieEnabled,
      'Online Status': navigator.onLine ? 'Online' : 'Offline'
    };
    
    for (const [key, value] of Object.entries(info)) {
      console.log(`  ${key}: ${value}`);
    }
  }
};

// Test Suite 4: Page Structure Tests
const TEST_SUITE_PAGE_STRUCTURE = {
  name: 'Page Structure & UI Elements',

  async testPageStructure() {
    TEST_UTILS.log('Testing page structure...', 'test');
    
    const elements = {
      'App shell': () => document.querySelector('.app-shell'),
      'Sidebar': () => document.querySelector('.sidebar'),
      'Main area': () => document.querySelector('.main-area'),
      'Content area': () => document.querySelector('#app-content'),
      'Dialog': () => document.querySelector('#app-dialog'),
      'Toast': () => document.querySelector('#toast')
    };
    
    for (const [name, finder] of Object.entries(elements)) {
      const element = finder();
      if (element) {
        TEST_UTILS.log(`✓ ${name} element found`, 'success');
      } else {
        TEST_UTILS.log(`✗ ${name} element not found`, 'warning');
      }
    }
  },

  async testNavigation() {
    TEST_UTILS.log('Testing navigation menu...', 'test');
    
    const navItems = [
      'overview', 'students', 'groups', 'subjects', 'activities', 'daily-followup', 'competencies'
    ];
    
    for (const item of navItems) {
      const element = document.querySelector(`[data-view="${item}"]`);
      if (element) {
        TEST_UTILS.log(`✓ Navigation item: ${item}`, 'success');
      } else {
        TEST_UTILS.log(`✗ Navigation item not found: ${item}`, 'warning');
      }
    }
  }
};

// Test Suite 5: Performance Tests
const TEST_SUITE_PERFORMANCE = {
  name: 'Performance Metrics',

  async testLoadTime() {
    TEST_UTILS.log('Measuring page load time...', 'test');
    
    if (window.performance && window.performance.timing) {
      const timing = window.performance.timing;
      const loadTime = timing.loadEventEnd - timing.navigationStart;
      TEST_UTILS.log(`Page load time: ${loadTime}ms`, 'info');
      
      if (loadTime < 2000) {
        TEST_UTILS.log('✓ Load time is excellent', 'success');
      } else if (loadTime < 5000) {
        TEST_UTILS.log('⚠️ Load time could be improved', 'warning');
      } else {
        TEST_UTILS.log('✗ Load time is slow', 'error');
      }
    } else {
      TEST_UTILS.log('Performance Timing API not available', 'warning');
    }
  },

  async testMemoryUsage() {
    TEST_UTILS.log('Checking memory usage...', 'test');
    
    if (performance && performance.memory) {
      const memory = performance.memory;
      const usedMB = (memory.usedJSHeapSize / 1048576).toFixed(2);
      const limitMB = (memory.jsHeapSizeLimit / 1048576).toFixed(2);
      
      TEST_UTILS.log(`Memory usage: ${usedMB}MB / ${limitMB}MB`, 'info');
    } else {
      TEST_UTILS.log('Memory API not available (Chrome only)', 'warning');
    }
  },

  async testLocalStorageSize() {
    TEST_UTILS.log('Measuring localStorage size...', 'test');
    
    const storageKey = 'avaluatro.data.v1';
    const data = localStorage.getItem(storageKey);
    
    if (data) {
      const sizeKB = (data.length / 1024).toFixed(2);
      TEST_UTILS.log(`Data size: ${sizeKB}KB`, 'info');
      
      // Typical quota is 5-10MB
      if (sizeKB < 1024) {
        TEST_UTILS.log('✓ Storage usage is good', 'success');
      } else if (sizeKB < 5120) {
        TEST_UTILS.log('⚠️ Storage usage is moderate', 'warning');
      } else {
        TEST_UTILS.log('✗ Storage usage is high', 'error');
      }
    }
  }
};

// Master Test Runner
class TestRunner {
  constructor() {
    this.suites = [
      TEST_SUITE_LOCAL_STORAGE,
      TEST_SUITE_INSTITUTIONAL_FILES,
      TEST_SUITE_BROWSER_COMPATIBILITY,
      TEST_SUITE_PAGE_STRUCTURE,
      TEST_SUITE_PERFORMANCE
    ];
    this.results = {};
  }

  async runSuite(suite) {
    TEST_UTILS.log(`\n${'='.repeat(60)}`, 'info');
    TEST_UTILS.log(`Running: ${suite.name}`, 'test');
    TEST_UTILS.log(`${'='.repeat(60)}`, 'info');
    
    const results = { passed: 0, failed: 0, tests: [] };
    
    for (const [methodName, method] of Object.entries(suite)) {
      if (methodName === 'name' || typeof method !== 'function') continue;
      
      try {
        await method.call(suite);
        results.passed++;
        results.tests.push({ name: methodName, status: 'passed' });
      } catch (error) {
        results.failed++;
        results.tests.push({ name: methodName, status: 'failed', error: error.message });
        TEST_UTILS.log(`Error in ${methodName}: ${error.message}`, 'error');
      }
    }
    
    return results;
  }

  async runAll() {
    console.clear();
    TEST_UTILS.log('\n🧪 AVALUATRON INSTITUTIONAL LAYER TEST SUITE', 'info');
    TEST_UTILS.log(`Started: ${new Date().toLocaleString()}`, 'info');
    
    for (const suite of this.suites) {
      const results = await this.runSuite(suite);
      this.results[suite.name] = results;
    }
    
    this.printSummary();
  }

  printSummary() {
    TEST_UTILS.log('\n' + '='.repeat(60), 'info');
    TEST_UTILS.log('TEST SUMMARY', 'test');
    TEST_UTILS.log('='.repeat(60), 'info');
    
    let totalPassed = 0;
    let totalFailed = 0;
    
    for (const [suiteName, results] of Object.entries(this.results)) {
      const passed = results.passed;
      const failed = results.failed;
      const total = passed + failed;
      
      totalPassed += passed;
      totalFailed += failed;
      
      const status = failed === 0 ? '✅' : '⚠️';
      TEST_UTILS.log(`${status} ${suiteName}: ${passed}/${total} passed`, 'info');
    }
    
    console.log('');
    if (totalFailed === 0) {
      TEST_UTILS.log(`🎉 ALL TESTS PASSED! (${totalPassed} tests)`, 'success');
    } else {
      TEST_UTILS.log(`⚠️ SOME TESTS FAILED (${totalPassed} passed, ${totalFailed} failed)`, 'error');
    }
    
    TEST_UTILS.log(`Completed: ${new Date().toLocaleString()}\n`, 'info');
  }
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  window.TestRunner = TestRunner;
  window.TEST_UTILS = TEST_UTILS;
  
  // Auto-run tests when in test mode
  if (new URL(window.location).searchParams.get('test') === 'true') {
    const runner = new TestRunner();
    runner.runAll();
  }
}

// Export for Node.js (if using in a testing environment)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TestRunner, TEST_UTILS };
}
