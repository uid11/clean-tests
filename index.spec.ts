import {Suite} from './index.js';

const suite = new Suite('Basic tests of ...');

const getTestData = () => {
  // some actions
};

suite.addFunctionToScope(getTestData);

suite.addTest('some test', () => {
  // some asserts
});

suite.addTest('other test', {skip: 'reason ...'}, async () => {
  // ...
});

suite.addTest('third test', {only: true}, () => {
  const testData = getTestData();
  // ...
});

suite.addTest('test with timeout', {timeout: 500}, () => {});

suite.addTest('test with parameters', {parameters: ['foo']}, (parameter) => {
  assertValueIsTrue(parameters === 'foo');
});

const print = ({message}: {message: string}) => console.log(message);

// in main tests file
const events = await pack.run({
  completeOnFirstFailure: false,
  onPackRun: print,
  onTestRun: print,
  onTestCompleted: print,
  onPackCompleted: print,
});

/*

  Output:

The pack of tests named "Basic tests of ..." has been run.
✅️ some test
✅️ third test (3ms)
❌ failed test
 ...error details...
✅️ other test (4ms)
The pack of tests named "Basic tests of ..." has been completed in 10ms.
1 failed, 3 passed.
*/
