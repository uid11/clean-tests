import type {Suite} from './index';

export type AssertValueIsTrue = (<Type>(
  value: Type | true,
  payload?: Payload,
) => asserts value is true) &
  (<Type>(value: Type | true, message: string, payload?: Payload) => asserts value is true) & {
    assertCount: number;
    onFailure?:
      | ((value: unknown, message: string | undefined, payload?: Payload) => void)
      | undefined;
    onPass?: ((value: unknown, message: string | undefined, payload?: Payload) => void) | undefined;
  };

export type BaseTest<Parameters extends readonly unknown[] = readonly unknown[]> = Readonly<{
  body: Body<Parameters>;
  fail: boolean;
  name: string;
  only: boolean;
  parameters: Parameters;
  repeats: number;
  retries: number;
  skip: boolean | string;
  timeout: number;
  todo: boolean | string;
}>;

export type Body<Parameters extends readonly unknown[]> =
  | ((this: void, ...args: Parameters) => unknown)
  | undefined;

export type CachedBodiesCreator = (this: {
  scope: Record<string, Function>;
  source: string;
}) => unknown;

export type ClearTimeout = (this: void, id: number) => void;

export type EndedTestResult = TestResult<EndedTestStatus>;

export type EndedTestStatus = 'failed' | 'passed' | 'timedOut';

export type EndResult =
  | EndedTestResult
  | Readonly<{startTime: Date; status: 'interrupted'}>
  | WithStatus<NotStartedTestStatus>;

export type FilterTestError<Test extends BaseTest> = Readonly<{error: unknown; test: Test}>;

export type InterruptedRunStatus =
  | 'interruptedByMaxFailures'
  | 'interruptedBySignal'
  | 'interruptedByTimeout';

/**
 * Returns a copy of the object type with mutable properties.
 * `Mutable<{readonly foo: string}>` = `{foo: string}`.
 */
export type Mutable<Type> = {
  -readonly [Key in keyof Type]: Type[Key];
};

export type MutableRunResult<Test extends BaseTest> = Mutable<
  Omit<
    RunResult<Test>,
    | 'filterTestsErrors'
    | 'onSuiteEndErrors'
    | 'onSuiteStartErrors'
    | 'onTestEndErrors'
    | 'onTestStartErrors'
  >
> & {
  filterTestsErrors: FilterTestError<Test>[];
  onSuiteEndErrors: unknown[];
  onSuiteStartErrors: unknown[];
  onTestEndErrors: TestEndError<Test>[];
  onTestStartErrors: TestStartError<Test>[];
};

export type NotStartedTestStatus = 'hasNoBody' | 'skipped' | 'wasNotRunInTime';

export type Options<Test extends BaseTest> = Partial<RunOptions<Test>>;

export type Payload = Readonly<Record<string, unknown>>;

export type Runner<Test extends BaseTest> = Generator<
  RunnerState,
  undefined,
  'interrupted' | TestUnit<Test> | undefined
>;

export type RunnerState = Readonly<{
  isAtMaxConcurrency: boolean;
  nextTestEnd: Promise<void> | undefined;
}>;

export type RunOptions<Test extends BaseTest> = Readonly<{
  clearTimeout: ClearTimeout;
  concurrency: number;
  filterTests: (this: Suite<Test>, options: Options<Test>, test: Test) => boolean;
  maxFailures: number;
  name: string;
  now: (this: void) => number;
  onelineTapOutput: boolean;
  onSuiteEnd: (
    this: Suite<Test>,
    options: Options<Test>,
    runResult: RunResult<Test>,
  ) => Promise<void> | void;
  onSuiteStart: (this: Suite<Test>, options: Options<Test>) => Promise<void> | void;
  onTestEnd: (this: Suite<Test>, options: Options<Test>, event: TestEndEvent<Test>) => void;
  onTestStart: (this: Suite<Test>, options: Options<Test>, event: TestStartEvent<Test>) => void;
  print: (this: void, message: string) => void;
  repeats: number;
  retries: number;
  runTimeout: number;
  setTimeout: SetTimeout;
  signal: AbortSignal | undefined;
  testTimeout: number;
}>;

export type RunStatus = InterruptedRunStatus | 'failed' | 'passed';

export type RunResult<Test extends BaseTest> = Readonly<{
  duration: number;
  filterTestsErrors: readonly FilterTestError<Test>[];
  name: string;
  onSuiteEndErrors: readonly unknown[];
  onSuiteStartErrors: readonly unknown[];
  onTestEndErrors: readonly TestEndError<Test>[];
  onTestStartErrors: readonly TestStartError<Test>[];
  runStatus: RunStatus;
  startTime: Date;
  tapOutput: string;
  testsInRun: number;
  testsInSuite: number;
}> &
  Readonly<Record<Status, number>>;

export type SetTimeout = (this: void, handler: () => void, timeout: number) => unknown;

export type Status = NotStartedTestStatus | 'interrupted' | EndedTestStatus;

export type Task<Test extends BaseTest> = {
  readonly clear: (this: void) => void;
  readonly end: Promise<void>;
  isEnded: boolean;
  readonly startTime: Date;
  readonly unit: TestUnit<Test>;
};

export type TestEndError<Test extends BaseTest> = Readonly<{
  error: unknown;
  event: TestEndEvent<Test>;
}>;

export type TestEndEvent<Test extends BaseTest> = TestWithCounters<Test> &
  Readonly<{result: TestResult; tapOutput: string}>;

export type TestResult<SomeStatus extends Status = Status> = Readonly<{
  duration: number;
  error: unknown;
  hasError: boolean;
  startTime: Date;
  status: SomeStatus;
}>;

export type TestStartError<Test extends BaseTest> = Readonly<{
  error: unknown;
  event: TestStartEvent<Test>;
}>;

export type TestStartEvent<Test extends BaseTest> = TestWithCounters<Test> &
  Readonly<{status: NotStartedTestStatus | undefined}>;

export type TestUnit<Test extends BaseTest> = TestWithCounters<Test> & {
  isEnded: boolean;
  readonly onEnd: TestUnitOnEnd<Test> | undefined;
  readonly status: 'skipped' | undefined;
};

export type TestUnitOnEnd<Test extends BaseTest> = (
  unit: TestUnit<Test>,
  result: TestResult,
) => void;

export type TestUnits<Test extends BaseTest> = Generator<
  TestUnit<Test> | undefined,
  undefined,
  'isRunning' | undefined
>;

export type TestWithCounters<Test extends BaseTest> = Readonly<{
  repeatIndex: number;
  retryIndex: number;
  test: Test;
}>;

export type TestWithParameters<Test extends BaseTest, Parameters extends readonly unknown[]> = Pick<
  Partial<BaseTest<Parameters>>,
  'body' | 'parameters'
> &
  Omit<Partial<Test>, 'body' | 'parameters'>;

type WithStatus<SomeStatus extends Status> = SomeStatus extends Status
  ? Readonly<{status: SomeStatus}>
  : never;
