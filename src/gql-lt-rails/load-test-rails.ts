import { parseISO } from 'date-fns';
import { JSONPath } from 'jsonpath-plus';
import { TestStep, GraphqlReq, Test } from './test-types';
import { Logger } from './logger';
import { User } from './test-users';
const DEBUG = true;

interface RunStepsParams {
  test: Test;
  errors: any;
  successRate: any;
  graphQL_reqs: any;
  user: User;
  hosts: string[];
  sleep: (n: number) => void;
  http: any;
}

export class LoadTestRails {
  public static runSteps(params: RunStepsParams) {
    const { test, errors, successRate, graphQL_reqs, user, hosts, sleep, http } = params;
    const testSteps = test.testSteps;
    const host = hosts[0];
    const variableSettings = new VariableSettings();
    variableSettings.setUser(user);
    const location = 'GQL_LoadTestRails.runSteps';
    Logger.log(location, `Starting steps for user ${user.email}, id ${user.id} `);
    // For this user, rotate through all steps
    let lastStepStartTime = '';
    let sleepTime = 0;

    for (let i = 0; i < testSteps.length; i++) {
      const step = testSteps[i];
      const numberOfRepeats = step.numberOfRepeats ? step.numberOfRepeats : 1;

      const payload = variableSettings.calcPayLoad(step);

      for (let k = 0; k < numberOfRepeats; k++) {
        DEBUG && Logger.debug(location, `started step ${i}, repeat ${k}`);
        const params = LoadTestRails.calcParams(variableSettings);
        const res = http.post(host, payload, params);
        let jsonResp: any;
        try {
          jsonResp = JSON.parse(res.body as string);
        } catch (e) {
          Logger.error(location, 'Error parsing result from server', e);
        }
        let success = true;
        if (!LoadTestRails.checkResult(step, jsonResp)) {
          errors.add(1);
          success = false;
          Logger.error(location, `checkResult failed :${JSON.stringify({ step, payload, params, jsonResp }, null, 2)}`);
        } else {
          successRate.add(1);
        }

        const reqMeta: GraphqlReq = {
          queryname: JSON.stringify(step.operationName),
          query: '',
          ...res.timings,
          success: success,
        };
        graphQL_reqs.add(1, reqMeta);
        variableSettings.addResults(step, jsonResp);
        if (step.sleepTimeout) {
          sleepTime = step.sleepTimeout;
        } else {
          // Calculate the sleep time by computing distance of recorded steps
          if (i < testSteps.length - 1) {
            // There is a next step
            const nextStep = testSteps[i + 1];
            if (step.startTime && nextStep.startTime) {
              const currentStartTime = new Date(parseISO(step.startTime)).getTime();
              const nextStartTime = new Date(parseISO(nextStep.startTime)).getTime();
              sleepTime = (nextStartTime - currentStartTime) / 1000;
              DEBUG && Logger.debug(location, `${currentStartTime} - ${lastStepStartTime} = ${sleepTime} ${step.query}`);
            } else {
              sleepTime = 0;
            }
          }
        }

        DEBUG && Logger.debug(location, `sleepTime=${sleepTime} \n\n\n`);
        if (sleep && sleepTime) {
          if (sleepTime > 5) {
            Logger.log(location, `Warning sleep for ${sleep} step ${JSON.stringify(step, null, 2)}`);
          }
          sleep(sleepTime);
        }
      }
    }
    console.info(`Completed steps for user ${user.email}, id ${user.id} `);
  }

  /**
   * because the steps are originally recorded from a user session as part of the test authoring process
   * the testSteps likely have the original results data hanging around.  This confuses diagnostic output
   * so we remove it prior to running
   */
  public static cleanResults(testSteps: TestStep[]) {
    for (let i = 0; i < testSteps.length; i++) {
      const step = testSteps[i];
      if (step.result) {
        delete step.result; // For cleaner error output
      }
    }
  }

  public static calcParams(variableSettings: VariableSettings): object {
    const result: any = { headers: {} };
    const headers = variableSettings.getHeaders();
    for (const header of headers) {
      result.headers[header.id] = header.value;
      DEBUG &&
        Logger.debug(
          'GQL_LoadTestRails.calcParams.loop',
          `header.id=${header.id} header.value = ${header.value}, result=${JSON.stringify(result)}`
        );
    }
    DEBUG &&
      Logger.debug(
        'GQL_LoadTestRails.calcParams',
        `params = ${JSON.stringify(result)} variableSettings.getHeaders()=${JSON.stringify(variableSettings.getHeaders())}`
      );
    return result;
  }

  public static checkResult(step: TestStep, result: any): boolean {
    const location = 'GQL_LoadTestRails.runStapes';
    let pass = true;
    if (step.resultChecks) {
      step.resultChecks.forEach(resultCheck => {
        const spot = JSONPath({
          path: resultCheck.jsonPath,
          json: result,
        });
        let len = 0;
        if (spot) {
          if (spot[0]) {
            len = spot[0].length;
          }
        } else {
          Logger.warn(location, `${resultCheck.jsonPath} was null`);
        }
        if (resultCheck.truthy && (!spot || len == 0)) {
          Logger.error(location, `Expected ${resultCheck.jsonPath} to exist but it didn't. spot: ${JSON.stringify(spot)}`);
          pass = resultCheck.warnOnly ? pass : false;
        } else if (resultCheck.min && len < resultCheck.min) {
          Logger.error(
            location,
            `Result size check failed for ${resultCheck.jsonPath}. Expected at least ${
              resultCheck.min
            } and got ${len}. spot: ${JSON.stringify(spot)}`
          );
          pass = resultCheck.warnOnly ? pass : false;
        } else if (resultCheck.max && len > resultCheck.max) {
          Logger.error(
            location,
            `Result size check failed for ${resultCheck.jsonPath}. Expected at least ${
              resultCheck.min
            } and got ${len}. spot: ${JSON.stringify(spot)}`
          );
          pass = resultCheck.warnOnly ? pass : false;
        } else {
          DEBUG && Logger.debug(location, `Result check passed for ${resultCheck.jsonPath}.`);
        }
        //          console.log(step.result);
      });
    }

    return pass;
  }
}

export class VariableSettings {
  private results: any = {};
  private readonly httpHeaders: { id: string; value: string }[];
  constructor() {
    this.httpHeaders = [{ id: 'Content-Type', value: 'application/json' }];
  }
  getHeaders() {
    return this.httpHeaders;
  }

  setUser(user: User) {
    this.results.user = { user };
  }
  addResults(step: TestStep, results: any): void {
    if (step.resultId) {
      this.results[step.resultId] = results;
    }
    if (step.httpHeaderSetters) {
      for (const setter of step.httpHeaderSetters) {
        const valueArray = JSONPath({
          path: setter.jsonPath,
          json: results,
        });
        if (!valueArray) {
          throw new Error(
            `Cannot find path ${setter.jsonPath} in results ${JSON.stringify(results, null, 2)} of step ${JSON.stringify(step, null, 2)}`
          );
        }
        const value = valueArray[0];
        if (!value) {
          throw new Error(
            `Cannot find path ${setter.jsonPath} in results ${JSON.stringify(results, null, 2)} of step ${JSON.stringify(step, null, 2)}`
          );
        }
        const header = { id: setter.header, value: `${setter.prefix || ''}${value}${setter.suffix || ''}` };
        DEBUG && Logger.debug('VariableSettings.addResults', `pushing ${JSON.stringify(header)}`);
        this.httpHeaders.push(header);
      }
    }
  }
  computeVariables(step: TestStep): any {
    const variables: any = step.variables;
    const location = 'VariableSettings.computeVariables';
    if (step.variableSettings) {
      step.variableSettings.forEach(setting => {
        const source = this.results[setting.valueFromResultId];
        if (!source) {
          throw new Error(`Cannot find source resultId ${setting.valueFromResultId}`);
        }
        const valueArray = JSONPath({
          path: setting.jsonPath,
          json: source,
        });
        if (!valueArray) {
          throw new Error(`Cannot find path ${setting.jsonPath} in resultId ${setting.valueFromResultId}`);
        }
        const value = valueArray[0];
        if (!value) {
          Logger.error(location, `searched for ${setting.jsonPath} failed in ${JSON.stringify(source)}`);
          throw new Error(`Cannot find path ${setting.jsonPath} in resultId ${setting.valueFromResultId}`);
        }
        let found = false;
        for (let key in variables) {
          if (key === setting.variableName) {
            found = true;
            variables[key] = value;
          }
        }
        if (!found) {
          throw new Error(`Cannot find variable name ${setting.variableName} in ${JSON.stringify(variables)}`);
        }
      });
      DEBUG && Logger.debug(location, `Variables updated ${JSON.stringify(variables)}`);
    }
    return variables;
  }

  calcPayLoad(step: TestStep): string {
    return JSON.stringify({
      query: step.query,
      operationName: step.operationName,
      variables: this.computeVariables(step),
    });
  }
}
