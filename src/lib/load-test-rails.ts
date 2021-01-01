import { parseISO } from 'date-fns';
import { JSONPath } from 'jsonpath-plus';
import { TestStep, GraphqlReq, Test } from './test-types';
import { Logger } from './logger';
import { User } from './test-users';
import * as _ from 'lodash';
const DEBUG = false;

interface RunStepsParams {
  test: Test;
  user: User;
  hosts: string[];

  // k6 objects passed to allow dry run outside of k6 runtime
  errors: any;
  successRate: any;
  graphQL_reqs: any;
  sleep: (n: number) => void;
  check: any;
  http: any;
  crypto: any;
  fail: any;
}

export class LoadTestRails {
  public static runSteps(params: RunStepsParams) {
    const { test, errors, successRate, graphQL_reqs, user, hosts, sleep, http, crypto, check, fail } = params;
    const testSteps = test.testSteps;
    const variableSettings = new VariableSettings();
    variableSettings.setUser(user);
    const location = 'LoadTestRails.runSteps';
    Logger.log(location, `Starting steps for user ${user.email}`);
    // For this user, rotate through all steps
    let lastStepStartTime = '';
    let sleepTime = 0;

    for (let i = 0; i < testSteps.length; i++) {
      const step = testSteps[i];
      const numberOfRepeats = step.numberOfRepeats ? step.numberOfRepeats : 1;

      const payload = variableSettings.calcPayLoad(step);
      const host = step.host ? hosts[step.host] : hosts[0];

      for (let k = 0; k < numberOfRepeats; k++) {
        const url = `${host}${step.queryStrings ? `?${step.queryStrings}` : ''}`;
        Logger.log(location, `user ${user.email} started step ${i}, repeat ${k} operationName=${step.operationName} url=${url}`);
        const params = LoadTestRails.calcParams(step, variableSettings, crypto);
        const res = http.post(url, payload, params);
        let success = true;
        const jsonResp = LoadTestRails.checkResult(step, res);
        if (!jsonResp) {
          check(1, { resultCheck: (r: number) => r === 0 });
          errors.add(1);
          success = false;
          Logger.error(location, `checkResult failed :${JSON.stringify({ step, payload, params, jsonResp }, null, 2)}`);
          fail('checkResult did not pass');
          return;
        } else {
          check(1, { resultCheck: (r: number) => r === 1 });
          successRate.add(1);
        }

        const reqMeta: GraphqlReq = {
          queryname: `${step.stepType || 'graphql'}-${step.operationName || 'op missing'}`,
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
          if (sleepTime > 20) {
            Logger.warn(location, `Warning sleep for ${sleepTime}`);
          }
          sleep(sleepTime);
        }
      }
    }
    console.info(`Completed steps for user ${user.email}`);
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

  public static calcParams(step: TestStep, variableSettings: VariableSettings, crypto?: any): object {
    const result: any = { headers: {} };
    const headers = variableSettings.getHeaders();
    if (step.httpHeader) {
      for (const header of step.httpHeader) {
        let value = header.value;
        if (header.hashCompute && crypto) {
          let hasher = crypto.createHMAC(header.hashCompute.algorithm, header.hashCompute.secret);
          hasher.update(unescape(encodeURIComponent(step.payload)));
          let hash = hasher.digest('base64');
          // https://github.com/loadimpact/k6/issues/1770
          value = hash;
        }
        if (!crypto) {
          value = 'TBD'; // Must be a dry run
        }
        if (!value) {
          throw new Error(`Could not compute value in calcParams ${JSON.stringify(step)}`);
        }
        headers.push({ id: header.id, value });
      }
    }
    for (const header of headers) {
      result.headers[header.id] = header.value;
    }
    // DEBUG &&
    //   Logger.debug(
    //     'LoadTestRails.calcParams',
    //     `params = ${JSON.stringify(result)} variableSettings.getHeaders()=${JSON.stringify(variableSettings.getHeaders())}`
    //   );
    return result;
  }

  public static checkResult(step: TestStep, res: any): object | undefined {
    const location = 'LoadTestRails.checkResult';
    if (step.httpResponseCheck) {
      if (step.httpResponseCheck !== res.status) {
        Logger.error(location, `HTTP Status check failed - expected ${step.httpResponseCheck}, got ${res.status}`);
        return undefined;
      }
    }
    let jsonResp: any = {};
    let pass = true;
    if (step.resultChecks) {
      try {
        jsonResp = res.body ? JSON.parse(res.body as string) : undefined;
      } catch (e) {
        Logger.error(location, `Error parsing result from server ${JSON.stringify(step)}`, e);
      }

      step.resultChecks.forEach(resultCheck => {
        const spot = JSONPath({
          path: resultCheck.jsonPath,
          json: jsonResp,
        });
        let len = 0;
        let value: any = undefined;
        if (spot) {
          if (spot[0]) {
            len = spot[0].length;
            value = spot[0];
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
        } else if (resultCheck.equal && resultCheck.equal != value) {
          Logger.error(
            location,
            `Result value chcek failed for ${resultCheck.jsonPath}. Expected at least ${resultCheck.equal} and got ${value}.`
          );
          pass = resultCheck.warnOnly ? pass : false;
        } else {
          DEBUG && Logger.debug(location, `Result check passed for ${resultCheck.jsonPath}.`);
        }
        //          console.log(step.result);
      });
    }
    !pass && Logger.debug(location, `jsonResp=${JSON.stringify(jsonResp, null, 2)}`);

    return pass ? jsonResp : undefined;
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

  getValue(resultId: string, jsonPath: string, step: TestStep): (string | number)[] {
    const location = 'VariableSettings.getValue';
    const source = this.results[resultId];
    if (!source) {
      throw new Error(`${location} - Cannot find source resultId ${resultId} in step ${JSON.stringify(step)}`);
    }
    const valueArray = JSONPath({
      path: jsonPath,
      json: source,
    });
    if (!valueArray) {
      throw new Error(`${location} -Cannot find path ${jsonPath} in resultId ${resultId}`);
    }
    const value = valueArray[0];
    if (!value) {
      Logger.error(location, `searched for ${jsonPath} failed in ${JSON.stringify(source)}`);
      throw new Error(`Cannot find path ${jsonPath} in resultId ${resultId}`);
    }
    return valueArray;
  }

  computeVariables(step: TestStep): any {
    const variables: any = step.variables;
    const location = 'VariableSettings.computeVariables';
    if (step.variableSettings) {
      step.variableSettings.forEach(setting => {
        const valueArray = this.getValue(setting.valueFromResultId, setting.jsonPath, step);
        const value = valueArray[0];
        _.set(variables, setting.variableName, value);
      });
      DEBUG && Logger.debug(location, `Variables updated ${JSON.stringify(variables)}`);
    }
    return variables;
  }

  substitutePayload(step: TestStep): string {
    if (!step.payloadChanges || step.payloadChanges.length === 0) {
      return step.payload;
    }
    const parsedPayload = typeof step.payload === 'string' ? JSON.parse(step.payload) : step.payload;

    for (const change of step.payloadChanges) {
      const resultId = change.valueFromResultId;
      const resultPath = change.jsonPathInResults;
      const value = this.getValue(resultId, resultPath, step);
      _.set(parsedPayload, change.findAndReplaceJsonPath, value[0]);
    }
    return JSON.stringify(parsedPayload);
  }

  calcPayLoad(step: TestStep): string {
    if (step.stepType === 'rest') {
      return this.substitutePayload(step);
    }
    return JSON.stringify({
      query: step.query,
      operationName: step.operationName,
      variables: this.computeVariables(step),
    });
  }
}
