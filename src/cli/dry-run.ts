import { LoadTestRails, VariableSettings } from '../lib/load-test-rails';
import { Logger } from '../lib/logger';
import { User } from '../lib/test-users';
import { TestStep } from '../lib/test-types';

const DEBUG = false;

export function dryRun(users: User[], steps: TestStep[]) {
  const variableSettings = new VariableSettings();
  users.forEach(user => {
    console.log(`email: ${user.email}`);
    variableSettings.setUser(user);
    steps.forEach(step => {
      DEBUG && Logger.debug('dryRun', JSON.stringify(step, null, 2));
      step.variables = variableSettings.computeVariables(step);
      if (!LoadTestRails.checkResult(step, { body: JSON.stringify(step.result), status: step.httpResponse })) {
        console.error(step);
        throw new Error('Step checker failed');
      }
      variableSettings.addResults(step, step.result);
    });
  });
}
