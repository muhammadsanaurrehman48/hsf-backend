#!/usr/bin/env node

/**
 * TEST: OPD Token Daily Reset Verification
 * 
 * This tests that tokens reset at midnight with the format: T-{roomNo}-{counter}
 * Counter resets to 1 each day at 00:00:00
 */

import { getDailyTokenNumber, generateOPDToken, isToday } from '../utils/tokenUtils.js';

console.log('\n=== TESTING OPD TOKEN DAILY RESET ===\n');

// Test 1: Get daily token number with empty queue
console.log('Test 1: Empty queue');
const emptyCounter = getDailyTokenNumber([]);
console.log(`  Expected: 1, Got: ${emptyCounter}`);
console.log(`  Result: ${emptyCounter === 1 ? '✅ PASS' : '❌ FAIL'}`);

// Test 2: Simulate patients from today
console.log('\nTest 2: Patients added today');
const todayPatients = [
  { createdAt: new Date(Date.now() - 60000) }, // 1 min ago
  { createdAt: new Date(Date.now() - 120000) }, // 2 min ago
  { createdAt: new Date(Date.now() - 180000) }, // 3 min ago
];
const todayCounter = getDailyTokenNumber(todayPatients);
console.log(`  Expected: 4, Got: ${todayCounter}`);
console.log(`  Result: ${todayCounter === 4 ? '✅ PASS' : '❌ FAIL'}`);

// Test 3: Simulate patients from yesterday (should not count)
console.log('\nTest 3: Mixed patients (today + yesterday)');
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);

const mixedPatients = [
  { createdAt: yesterday }, // Yesterday
  { createdAt: yesterday }, // Yesterday
  { createdAt: new Date() }, // Today
];
const mixedCounter = getDailyTokenNumber(mixedPatients);
console.log(`  Expected: 2 (only today's patient + 1), Got: ${mixedCounter}`);
console.log(`  Result: ${mixedCounter === 2 ? '✅ PASS' : '❌ FAIL'}`);

// Test 4: Generate token format
console.log('\nTest 4: Token format');
const token = generateOPDToken('101', 5);
console.log(`  Generated token: ${token}`);
console.log(`  Expected format: T-101-5`);
console.log(`  Result: ${token === 'T-101-5' ? '✅ PASS' : '❌ FAIL'}`);

// Test 5: Check if date is today
console.log('\nTest 5: isToday function');
const today = new Date();
const tomorrow = new Date(Date.now() + 86400000);
const isTodayResult = isToday(today);
const isTomorrow = isToday(tomorrow);
console.log(`  Today check: ${isTodayResult} (Expected: true) - ${isTodayResult === true ? '✅ PASS' : '❌ FAIL'}`);
console.log(`  Tomorrow check: ${isTomorrow} (Expected: false) - ${isTomorrow === false ? '✅ PASS' : '❌ FAIL'}`);

// Test 6: Simulate midnight reset
console.log('\nTest 6: Midnight reset simulation');
const yesterday_999 = new Date();
yesterday_999.setDate(yesterday_999.getDate() - 1);
yesterday_999.setHours(23, 59, 59);

const today_0001 = new Date();
today_0001.setHours(0, 0, 1);

const patientsBeforeMidnight = [
  { createdAt: yesterday_999 },
];

const patientsAfterMidnight = [
  { createdAt: yesterday_999 }, // From yesterday - should NOT be counted
  { createdAt: today_0001 },    // From today - should be counted
];

const counterBeforeMidnight = getDailyTokenNumber(patientsBeforeMidnight);
const counterAfterMidnight = getDailyTokenNumber(patientsAfterMidnight);

console.log(`  Before midnight - Counter: ${counterBeforeMidnight} (yesterday's patients)`);
console.log(`  After midnight - Counter: ${counterAfterMidnight} (today's patients only)`);
console.log(`  Reset working: ${counterBeforeMidnight === 1 && counterAfterMidnight === 2 ? '✅ PASS' : '❌ FAIL'}`);
console.log(`  Yesterday date: ${yesterday_999.toISOString()}`);
console.log(`  Today date: ${today_0001.toISOString()}`);

console.log('\n=== TESTS COMPLETED ===\n');
