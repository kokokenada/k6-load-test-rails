export interface TestConfig {
  stepsFile: string;
  hosts: string[];
  emailDomain: string;
  maxUsers: number;
  rampRateSeconds: number;
  durationMinutes: number;
}

export interface Test {
  testName: string;
  testSteps: TestStep[];
}

type StepType = 'rest' | 'graphql';

export interface TestStep extends RESTTestStep, TestStepGraphQL {}

export interface RESTTestStep extends TestStepBase {
  method?: 'get' | 'post' | string; // etc
  payload?: any;
  queryStrings?: string;
  payloadChanges?: { findAndReplaceJsonPath: string; valueFromResultId: string; jsonPathInResults: string }[]; // findAndReplaceJsonPath syntax https://lodash.com/docs/4.17.15#set, i.e. drop the $.
}

export interface TestStepGraphQL extends TestStepBase {
  query?: string; // Query captured by trace
  operationName?: string | null; // operation name captured by trace
  variables?: any; // Original variables captured by trace
  variableSettings?: VariableSetting[]; // Defines how you should change the variables for this step (by looking at results of previous steps)
}

export interface TestStepBase {
  stepType?: StepType; // Defaults to graphql
  host?: number; // Index into hosts array, defaults to first.  This allows the test to hit >1 end point.  E.g. a REST end point and a GraphQL end point
  name?: string; // The name of the test used by cli to identify which test is being run
  startTime?: string; // Captured by trace
  endTime?: string; // Captured by trace
  result?: any; // Captured by trace - this is the result set when running the app - it serves as help example data when defining checking and using dry run feature
  duration?: number; // Captured by trace - how long the server took to respond during the trace
  resultId?: string; // Add an identifier string if you want to reference the query results in future steps.  This causes the test system to save the result
  resultChecks?: ResultCheck[]; // Add checks to make sure the results are OK
  numberOfRepeats?: number; // The number of times this specific step should be repeated (e.g. to simulate pollingInterval)
  sleepTimeout?: number; // The timeout variable in milliseconds used for sleep method.
  // sleepTimeout defaults to startTime - startTime(previous step) so that the pace the virtual user sets matches what was recorded.
  // You can set sleepTimeout to override this.  E.g. if you are stitching together different capture sessions
  // If you want to assess how many users the system can handle (opposed to find how it breaks under load) it is important to
  // put sleeps into the tests so that virtual users in the load test behave how you expect real users to behave.
  httpHeaderSetters?: HTTPHeaderSetter[]; // If the result of the request should set a header in subsequent requests (e.g. auth token)
  httpHeader?: HTTPHeader[];
  httpResponseCheck?: number; // If present the test will ensure the server returns the entered HTTP result code
  httpResponse?: number; // Mocked HTTP response for dry run
}

export interface HTTPHeader {
  id: string;
  value?: string;
  hashCompute?: {
    secret: string;
    algorithm: string;
  };
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
  equal?: string; // if it is a string, it should match
  truthy?: boolean; // Existence check
  warnOnly?: boolean; // Perhaps you only want a console warning, not a failer
}

export interface VariableSetting {
  valueFromResultId: string; // The resultId specified in a previous step
  jsonPath: string; // The path to the value to substitute
  variableName: string; // The variable name to set (must be in Variables of the step) can be dot notation (uses _.set)
}

export interface GraphqlReq {
  query: string;
  success: boolean;
  queryname: string;
}
