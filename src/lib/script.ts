import { sleep, check, fail } from 'k6';
import http from 'k6/http';
import crypto from 'k6/crypto';
import { Counter, Rate } from 'k6/metrics';
import { LoadTestRails } from './load-test-rails';
import { TestConfig, Test } from './test-types';
import { TestUsers, User } from './test-users';

const TEST_CONFIG_FILE = './test-config.json';

let graphQL_reqs = new Counter('graphql_reqs');

export let errors = new Counter('errors');
export let successRate = new Rate('successRate');

// File opens must be here
const config: TestConfig = JSON.parse(open(TEST_CONFIG_FILE));
if (!config) {
  throw new Error(`Missing ${TEST_CONFIG_FILE}`);
}
const test: Test = JSON.parse(open(config.stepsFile));
LoadTestRails.cleanResults(test.testSteps);

const maxVUs = config.maxUsers;
const rateToAdd = config.rampRateSeconds;

// Called by k6 to initialize
export function setup() {
  const obj = { test, config };
  return obj;
}

export let options = {
  stages: [
    { duration: `${maxVUs * rateToAdd}s`, target: maxVUs },
    { duration: `${config.durationMinutes}m`, target: maxVUs },
    { duration: '20s', target: 0 },
  ],
  vusMax: maxVUs,
};
// Called by k6 for each invocation
export default function(context: any) {
  const config: TestConfig = context.config;
  const user: User = TestUsers.generateOneTestUser(config.emailDomain); // context.users[iterationIndex];
  const test: Test = context.test;
  // Rotate through all users see: https://docs.k6.io/docs/test-life-cycle
  console.log(`user=${JSON.stringify(user)}`);

  // For this user, rotate through all steps
  LoadTestRails.runSteps({
    test,
    errors,
    successRate,
    user,
    hosts: config.hosts,
    http,
    sleep,
    graphQL_reqs,
    crypto,
    check,
    fail,
  });
}

// Called by k6 when shutting down
export function teardown(_data: any) {}
