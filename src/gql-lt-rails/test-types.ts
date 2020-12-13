export interface GQLTestConfig {
  stepsFile: string;
  hosts: string[];
  usersFile: string;
  emailDomain: string;
}

export interface Test {
  testName: string;
  testSteps: TestStep[];
}

type StepType = 'rest' | 'graphql';

export interface TestStep extends RESTTestStep, TestStepGraphQL {}
// name?: string;
// query: string; // Query captured by trace
// operationName: string | null; // operation name captured by trace
// variables: any; // Original variables captured by trace
// startTime?: string; // Captured by trace
// endTime?: string; // Captured by trace
// result?: any; // Captured by trace - this is the result set when running the app - it serves as help example data when defining checking and using dry run feature
// duration?: number; // Captured by trace
// resultId?: string; // Add an identifier string if you want to reference the query results in future steps.  This causes the test system to save the result
// resultChecks?: ResultCheck[]; // Add checks to make sure the results are OK
// variableSettings?: VariableSetting[]; // Define how you should change the variables for this step (by looking at results of previous steps)
// numberOfRepeats?: number; // The number of times this specific step should be repeated (e.g. to simulate pollingInterval)
// sleepTimeout?: number; // The timeout variable in milliseconds used for sleep method.  Defaults to startTime - startTime(previous step)
// httpHeaderSetters?: HTTPHeaderSetter[]; // If the result of the request should set a header in subsequent requests (e.g. auth token)

export interface RESTTestStep extends TestStepBase {
  method?: 'get' | 'post' | string; // etc
  payload?: any;
  payloadChanges?: { findJsonPath: string; valueFromResultId: string; jsonPathInResults: string }[];
  httpResponseCheck?: number
}

export interface TestStepGraphQL extends TestStepBase {
  query?: string; // Query captured by trace
  operationName?: string | null; // operation name captured by trace
  variables?: any; // Original variables captured by trace
  variableSettings?: VariableSetting[]; // Define how you should change the variables for this step (by looking at results of previous steps)
}

export interface TestStepBase {
  stepType?: StepType; // Defaults to graphql
  host?: number; // Index into hosts array, defaults to first
  name?: string;
  startTime?: string; // Captured by trace
  endTime?: string; // Captured by trace
  result?: any; // Captured by trace - this is the result set when running the app - it serves as help example data when defining checking and using dry run feature
  duration?: number; // Captured by trace
  resultId?: string; // Add an identifier string if you want to reference the query results in future steps.  This causes the test system to save the result
  resultChecks?: ResultCheck[]; // Add checks to make sure the results are OK
  numberOfRepeats?: number; // The number of times this specific step should be repeated (e.g. to simulate pollingInterval)
  sleepTimeout?: number; // The timeout variable in milliseconds used for sleep method.  Defaults to startTime - startTime(previous step)
  httpHeaderSetters?: HTTPHeaderSetter[]; // If the result of the request should set a header in subsequent requests (e.g. auth token)
}

export interface HTTPHeaderSetter {
  jsonPath: string;
  header: string;
  prefix?: string;
  suffix?: string;
}

// jsonPath's are strings with a syntax defined here : https://www.npmjs.com/package/jsonpath-plus
// They let you pluck a object or value out of a JSON object
// It's just like XPath but for JSON

export interface ResultCheck {
  jsonPath: string; // the path to the object or array
  min?: number; // If it is an array, the minimum number of elements expected
  max?: number;
  truthy?: boolean; // Existence check
  warnOnly?: boolean; // Perhaps you only want a console warning, not a failer
}

export interface VariableSetting {
  valueFromResultId: string; // The resultId specified in a previous step
  jsonPath: string; // The path to the value to substitute
  variableName: string; // The variable name to set (must be in Variables of the step)
}

export interface GraphqlReq {
  query: string;
  success: boolean;
  queryname: string;
}
