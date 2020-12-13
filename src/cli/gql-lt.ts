#!/usr/bin/env node
import * as fs from 'fs';
import yargs from 'yargs';
import { Logger } from '../gql-lt-rails/Logger';
import { GQLTestConfig, Test } from '../gql-lt-rails/test-types';
import { TestUsers } from '../gql-lt-rails/test-users';
import { tests } from '../tests/tests';
import { dryRun } from './dry-run';

const DEBUG = false;
const commandName = 'gql-lt.ts';

interface Arguments {
  [x: string]: unknown;
  generateUsers?: boolean;
  numberOf?: number;
  domain?: string;
  dryRun?: boolean;
  file?: string;
  testName?: string;
  writeConfig?: boolean;
  hosts?: string[];
}

const argv: Arguments = yargs
  .command('generateUsers', 'Set webhooks and other necessary config')
  .command('dryRun', 'Set webhooks and other necessary config')
  .command('writeConfig', 'Write the configuration files to the dist directory')
  .option('f', { alias: 'file', describe: 'file to run' })
  .option('t', { alias: 'testName', describe: 'test to run' })
  .option('n', { alias: 'numberOf', describe: 'number of user', type: 'number' })
  .option('h', { alias: 'hosts', describe: 'one or more hosts', type: 'array' })
  .option('d', { alias: 'domain', describe: 'domain', type: 'string' }).argv;

Logger.debug(commandName, `args = ${JSON.stringify(argv, null, 2)}`, DEBUG);

function getTest(testName: string | undefined): Test | undefined {
  if (!testName) {
    Logger.error(commandName, 'missing -t');
    return undefined;
  }

  const test = tests.find(t => t.testName === testName);
  if (!test) {
    Logger.error(commandName, `Cannot fine ${testName} in tests ${tests.map(t => t.testName).join()}`);
    return undefined;
  }
  return test;
}

if (argv.generateUsers) {
  Logger.log(commandName, 'generating users');
  const userCount = argv.numberOf || 100;
  const emailDomain = argv.domain || 'test.com';
  const users = TestUsers.generateUsers(userCount, emailDomain);
  console.log(JSON.stringify(users, null, 2));
} else if (argv.writeConfig) {
  const usersFileName = 'users.json';
  const stepsFileName = 'steps.json';
  const configFileName = 'test-config.json';
  const target = './dist/';
  const userCount = argv.numberOf || 10;
  const emailDomain = argv.domain || 'test.com';
  const users = TestUsers.generateUsers(userCount, emailDomain);
  fs.writeFileSync(`${target}${usersFileName}`, JSON.stringify(users, null, 2));

  const test = getTest(argv.testName);
  if (!test) {
    process.exit(1);
  }
  fs.writeFileSync(`${target}${stepsFileName}`, JSON.stringify(test, null, 2));

  if (!argv.hosts || !argv.hosts.length) {
    Logger.error(commandName, 'Missing -h hosts');
    process.exit(1);
  }
  const hosts: string[] = argv.hosts;

  const config: GQLTestConfig = {
    usersFile: `./${usersFileName}`,
    stepsFile: `./${stepsFileName}`,
    hosts,
    emailDomain,
  };
  fs.writeFileSync(`${target}${configFileName}`, JSON.stringify(config, null, 2));
} else if (argv.dryRun) {
  const test = getTest(argv.testName);
  if (!test) {
    process.exit(1);
  }
  dryRun(TestUsers.generateUsers(1, 'test.com'), test.testSteps);
} else {
  yargs.showHelp();
  process.exit(1);
}
