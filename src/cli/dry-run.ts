import { LoadTestRails, VariableSettings } from '../gql-lt-rails/load-test-rails';
import { User } from '../gql-lt-rails/test-users';
import { TestStep } from '../gql-lt-rails/test-types';

export function dryRun(users: User[], steps: TestStep[]) {
  const variableSettings = new VariableSettings();
  users.forEach(user => {
    console.log(`User Id: ${user.id}, email: ${user.email}`);
    variableSettings.setUser(user)
    steps.forEach(step => {
      step.variables = variableSettings.computeVariables(step);
      if (!LoadTestRails.checkResult(step, step.result)) {
        console.error(step);
        throw new Error('Step checker failed');
      }
      variableSettings.addResults(step, step.result);
    });
  });
}
