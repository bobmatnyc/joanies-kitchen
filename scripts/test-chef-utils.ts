import { isSustainabilityFocused } from '../src/lib/utils/chef-utils.js';

console.log('Testing chef utility functions...\n');

// Test cases
const testCases = [
  {
    name: 'Joanie',
    specialties: ['seasonal', 'garden-to-table', 'improvisation', 'zero-waste', 'sustainability'],
    expected: true,
  },
  {
    name: 'Kenji',
    specialties: ['American', 'Asian', 'Science-Based Cooking', 'Technique'],
    expected: false,
  },
  {
    name: 'No specialties',
    specialties: null,
    expected: false,
  },
  {
    name: 'Farm-to-table chef',
    specialties: ['farm-to-table', 'local'],
    expected: true,
  },
  {
    name: 'Seasonal chef',
    specialties: ['seasonal', 'organic'],
    expected: true,
  },
];

let passed = 0;
let failed = 0;

for (const test of testCases) {
  const result = isSustainabilityFocused(test.specialties);
  const status = result === test.expected ? '✅ PASS' : '❌ FAIL';

  if (result === test.expected) {
    passed++;
  } else {
    failed++;
  }

  console.log(`${status} - ${test.name}`);
  console.log(`  Specialties: ${test.specialties?.join(', ') || 'none'}`);
  console.log(`  Expected: ${test.expected}, Got: ${result}\n`);
}

console.log(`\n${passed}/${testCases.length} tests passed`);

process.exit(failed > 0 ? 1 : 0);
