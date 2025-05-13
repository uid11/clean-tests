# clean-tests ✅️

[![NPM version][npm-image]][npm-url]
[![dependencies: none][dependencies-none-image]][dependencies-none-url]
[![minzipped size][size-image]][size-url]
[![code style: prettier][prettier-image]][prettier-url]
[![Conventional Commits][conventional-commits-image]][conventional-commits-url]
[![License MIT][license-image]][license-url]

A lightweight, zero-overhead ECMAScript test library with a programmatic API for any ECMAScript/TypeScript environment.

We create a `suite` of tests as a regular instance of the `Suite` class,
fill it with tests using the `suite.addTest` method, possibly export it, and run it using the `suite.run` method.

The tests are run in the same thread as the `suite.run` call, but in an isolated scope,
meaning that variables from the closure will not be available in the tests.
To access the utilities, asserts, and functions being tested in the suite,
we explicitly add them as functions to the suite scope using the `suite.addFunctionToScope` method.

A test is considered to have failed if it throws an exception
(or if the promise it returns is rejected — for example, for asynchronous functions).

## Basic example

```ts
import {assertValueIsTrue, Suite} from 'clean-tests';
import {sum} from './sum.js';

const suite = new Suite();

suite.addFunctionToScope(assertValueIsTrue);
suite.addFunctionToScope(sum);

suite.addTest('adds 1 + 2 to equal 3', () => {
  assertValueIsTrue(sum(1, 2) === 3);
});

const runResult = await suite.run();

assertValueIsTrue(runResult.runStatus === 'passed');
```

## Features

### Skipping tests

You can skip a specific test by giving it the `skip` option:

```ts
suite.addTest('skipped', {skip: true}, () => {
  // this code will never run
});

suite.addTest('skipped with reason', {skip: 'some reason''}, () => {
  // this code will never run
});
```

### todo tests

The test can be marked as a `todo` test — in this case it will be run, but will not affect the `runStatus`:

```ts
suite.addTest('todo test', {todo: true}, () => {
  // some code
});

suite.addTest('todo test with reason', {todo: 'some reason''}, () => {
  // some code
});
```

### only tests

The test can be marked as an `only` test — in this case, only `only` tests
(there may be several of them) will be run, regardless of filtering of tests:

```ts
suite.addTest('only test', {only: true}, () => {
  // some code
});
```

### fail tests

The test can be marked as a `fail` test — in this case the test will be considered `passed` if it throws
(or rejects the returned promise), and `failed` otherwise:

```ts
suite.addTest('fail test', {fail: true}, () => {
  throw new Error('should throws');
});
```

### Filtering of tests

Tests in `suite.run` can be filtered using the `filterTests` function
(filtering is ignored if there is at least one `only` test in the suite):

```ts
suite.addTest('foo', () => {
  // some code
});

suite.addTest('bar', () => {
  // some code
});

// will run only the test named 'foo'
const runResult = await suite.run({filterTests: (_options, test) => test.name === 'foo'});
```

The default filter of tests can be set when creating a suite
(the filter specified in `suite.run` will override it):

```ts
// run only tests with retries (i.e. tests that will be rerun if they fail)
const suite = new Suite({filterTests: (_options, test) => test.retries > 0});
```

### Asynchronous tests

If a test returns a promise (usually as asynchronous function), `clean-tests` ✅️ waits for it to be fulfilled.
Such a test is considered to have failed if the promise is rejected:

```ts
suite.addTest('asynchronous test', async () => {
  await new Promise((resolve) => setTimeout(resolve, 1_000));
});
```

For asynchronous tests you can specify a `timeout` in milliseconds, after which they will be considered failed:

```ts
suite.addTest('asynchronous test', {timeout: 1_000}, async () => {
  await new Promise((resolve) => setTimeout(resolve, 2_000));
});
```

The default `timeout` for each test can be set when creating the suite
(the `timeout` specified in `suite.run` will override it):

```ts
const suite = new Suite({testTimeout: 3_000});
```

By default `testTimeout` is `10_000` (10 seconds).

For asynchronous tests, you can specify `concurrency` (how many of them can be run at the same time at most):

```ts
const runResult = await suite.run({concurrency: 3});
```

The default `concurrency` can be set when creating a suite
(the `concurrency` specified in `suite.run` will override it):

```ts
const suite = new Suite({concurrency: 3});
```

By default `concurrency` is `1`.

## Install

Works in any environment that implements the `ECMAScript 2022` standard (or higher):
modern browser, [node](https://nodejs.org/en/) (version 16 or higher), [Deno](https://deno.com/), [Bun](https://bun.sh/).

```sh
npm install --save-dev clean-tests
```

## License

[MIT][license-url]

[conventional-commits-image]: https://img.shields.io/badge/Conventional_Commits-1.0.0-yellow.svg 'The Conventional Commits specification'
[conventional-commits-url]: https://www.conventionalcommits.org/en/v1.0.0/
[dependencies-none-image]: https://img.shields.io/badge/dependencies-none-success.svg 'No dependencies'
[dependencies-none-url]: https://github.com/uid11/clean-tests/blob/main/package.json
[license-image]: https://img.shields.io/badge/license-MIT-blue.svg 'The MIT License'
[license-url]: LICENSE
[npm-image]: https://img.shields.io/npm/v/clean-tests.svg 'clean-tests'
[npm-url]: https://www.npmjs.com/package/clean-tests
[prettier-image]: https://img.shields.io/badge/code_style-prettier-ff69b4.svg 'Prettier code formatter'
[prettier-url]: https://prettier.io/
[size-image]: https://img.shields.io/bundlephobia/minzip/clean-tests 'clean-tests'
[size-url]: https://bundlephobia.com/package/clean-tests
