import { sleep } from 'k6';
import http from 'k6/http';
import { Counter, Rate } from 'k6/metrics';
import { LoadTestRails } from './load-test-rails';
import { GQLTestConfig, Test } from './test-types';
import { User } from './test-users';

const TEST_CONFIG_FILE = './test-config.json';

let currentUserIdIndex = 0;
let graphQL_reqs = new Counter('graphql_reqs');

export let errors = new Counter('Errors');
export let successRate = new Rate('Successful Requests');

// File opens must be here
const config: GQLTestConfig = JSON.parse(open(TEST_CONFIG_FILE));
if (!config) {
  throw new Error(`Missing ${TEST_CONFIG_FILE}`);
}
const test: Test = JSON.parse(open(config.stepsFile));
LoadTestRails.cleanResults(test.testSteps);

const users = JSON.parse(open(config.usersFile));
if (!users?.length) {
  throw new Error('Could not find any users in ./users.json');
}
console.log(`Found ${users.length} users`);

// Called by k6 to initialize
export function setup() {
  const obj = { users, test, config };
  return obj;
}

// Called by k6 for each invocation
export default function(context: any) {
  const config: GQLTestConfig = context.config;
  const user: User = context.users[currentUserIdIndex];
  const test: Test = context.test;
  currentUserIdIndex++;
  // Rotate through all users see: https://docs.k6.io/docs/test-life-cycle
  if (currentUserIdIndex === context.users.length) {
    currentUserIdIndex = 0;
  }
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
  });
}

// Called by k6 when shutting down
export function teardown(_data: any) {}
