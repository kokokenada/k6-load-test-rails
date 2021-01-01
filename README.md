# Load Testing
* Seeded from https://github.com/k6io/template-typescript

## Generating a New Test Script
This is rudimentary tooling to assist with the generation of load test cases.

The overall strategy is to capture graphql queries issued by the ui, 
edit the captured queries to be the load test and then run them as a load test.

Some support for REST is also present and has been used to emulate thrid part systems calling a webhook
as part of the flow.

### Trace - Capture Queries
First turn tracing one by going to the /admin and turning on tracing.  This also writes
a local storage setting in order that the setting can be retained when sessions are re-started.

Then, perform steps in UI that you want to base the steps on.

Copy Generated Trace JSON into tests/<my test>.ts and export as testSteps as appropriate
types.  E.g.:
```typescript
export const myFirstTest: Test = {
  testName: 'myFirstTest',
  testSteps: [], // captured JSON goes here
}
```

The types are vital because it guides the modification of the captured steps
to include variability and correctness checks.

Then add the new test to src/tests/tests.ts so that the cli can find the test.

This has captured the raw queries, hard coded variables values and results (which serve as
convenient examples when defining your checks)

### Refining Queries and Defining Checks
The raw queries are a great starting point as they represent real user activity to the extent your
trace capture represents user activity. However, it would not be a realistic system test to if the
same user accessed the same results simultaneously.

So we need a way to customize the variables based on the previous results.  For example, if a
user displays a list of items and clicks one.  The item displayed should be one of the items
displayed in the list, not the item recorded by the trace capture.

Also, if lets the server refused to process a request due to an authentication problem or perhaps,
under load, the server returns incorrect results, how will you know?

To handle both of these issues, you must add some data elements to the captured GraphQL queries
to record data retrieved and use it in a future step.

See the comments in src/lib/test-types.ts file for descriptions on how to modify
the captured script to be an actual test script.

### Dry Run
Before running an actual load test, you can do some basic testing to make sure you 
have configured the checks and variable settings correctly.

```shell script
npx ts-node src/cli/ltr.ts --dry-run.ts -t <the name you gave your test>
```

## Setting up a Local Load Test Environment
It is a good idea to make sure your load tests are working targeting
a local instance of the app.  You can also use much of this
setup to load test a cloud instance by using your computer
to host the virtual users.

After you have the app up and running locally, install K6

* https://k6.io/docs/getting-started/installation (brew install k6)

## Running tests

* Build the tests (transpiles the Typescript so it is ready for k6)
```bash
$ npm run build
```
* There is a test test you can use to ensure k6 is working
```bash
$ k6 run dist/test-test.js
```
* Write configuration files to set target host and # of virtual users. e.g.:
```
npx ts-node src/cli/ltr.ts --write-config -t signUpAndBuy -h 'http://localhost:3000/ken-dev/api/graphql' 'http://localhost:3000/ken-dev/api/hooks'  -u 50 -m 5
```
* To see options:
```
npx ts-node src/cli/ltr.ts
```
* To run the test
```
npm run test
```

## Installing Reporting and DataViz

https://k6.io/docs/results-visualization/influxdb-+-grafana

```
brew install influxdb
brew install grafana
```
To launchd influxdb and restart at login:
```
brew services start influxdb
brew services start grafana


```
Or, if you don't want/need a background service you can just run:
```
influxd -config /usr/local/etc/influxdb.conf
grafana-server --config=/usr/local/etc/grafana/grafana.ini --homepath /usr/local/share/grafana --packaging=brew cfg:default.paths.logs=/usr/local/var/log/grafana cfg:default.paths.data=/usr/local/var/lib/grafana cfg:default.paths.plugins=/usr/local/var/lib/grafana/plugins
```

#### Running and capturing
```
k6 run --out influxdb=http://localhost:8086/myk6db dist/main.js
```
#### Using Graphana
* default id nd password is admin/admin
* create influx db data source (server: http://localhost:8086, db: myk6db)

## K6 is not Node
It's great that k6 defines tests in JavaScript and it was a deciding factor in its selection.
(Other tools, e.g. artillery use yaml files which are not as expressive or flexible)

However, k6 is written in go and hosts its own JavaScript engine.  Don't mistake it for node.
You may not be able to import any library.

By default, k6 can only run ES5.1 JavaScript code. To use TypeScript, we have to set up a bundler
 hat converts TypeScript to JavaScript code.

This project uses `Babel` and `Webpack` to bundle the different files - using the configuration of 
the [`webpack.config.js`](./webpack.config.js) file.

If you want to learn more, check out [Bundling node modules in k6]
(https://k6.io/docs/using-k6/modules#bundling-node-modules).

