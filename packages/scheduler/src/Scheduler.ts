import { push, pop, peek } from './SchedulerMinHeap';
import { getCurrentTime, isFn, isObject } from '../../shared/utils';
import {
  getTimeoutByPriorityLevel,
  NormalPriority,
  PriorityLevel,
} from './SchedulerPriorities';

type Callback = any; // (args: any) => void | any;

export interface Task {
  id: number;
  callback: Callback;
  priorityLevel: PriorityLevel;
  startTime: number;
  expirationTime: number;
  sortIndex: number;
}

type HostCallback = (hasTimeRemaining: boolean, currentTime: number) => boolean;

// 任务存储，最小堆
const taskQueue: Array<Task> = []; // 任务队列
const timerQueue: Array<Task> = []; // 有 delay 的任务队列

let taskIdCounter: number = 1;

let currentTask: Task | null = null;
let currentPriorityLevel: PriorityLevel = NormalPriority;

/** 在计时 */
let isHostTimeoutScheduled: boolean = false;

/** 在调度任务。 因为是单线程任务调度器 */
let isHostCallbackScheduled = false;
// This is set while performing work, to prevent re-entrance.
let isPerformingWork = false;

let schedulePerformWorkUntilDeadline: Function;

let isMessageLoopRunning = false;
let scheduledHostCallback: HostCallback | null = null;
let taskTimeoutID: number = -1;

let startTime = -1;

let needsPaint = false;

// Scheduler periodically yields in case there is other work on the main
// thread, like user events. By default, it yields multiple times per frame.
// It does not attempt to align with frame boundaries, since most tasks don't
// need to be frame aligned; for those that do, use requestAnimationFrame.
let frameInterval = 5; //frameYieldMs;

function cancelHostTimeout() {
  clearTimeout(taskTimeoutID);
  taskTimeoutID = -1;
}

/** 开始倒计时 */
function requestHostTimeout(callback: Callback, ms: number) {
  taskTimeoutID = setTimeout(() => {
    callback(getCurrentTime());
  }, ms);
}

/** 检查timerQueue中的任务，是否有任务到期了呢，到期了就把当前`有效`任务移动到taskQueue */
function advanceTimers(currentTime: number) {
  /** timerQueue 中的堆顶元素 */
  let timer: Task = peek(timerQueue) as Task;

  while (timer !== null) {
    if (timer.callback === null) {
      pop(timerQueue); // 边缘处理
    } else if (timer.startTime <= currentTime) {
      // case timerQueue 中的堆顶元素 开始排队时间 <= 当前时间 ： 可以进入 taskQueue 中排队了
      pop(timerQueue); // 从 timerQueue 中移除
      timer.sortIndex = timer.expirationTime; // 任务的sortIndex 设置为 `排队结束时间`
      push(taskQueue, timer); // 升级放入 taskQueue 中
    } else {
      return;
    }
    // 接着遍历最小堆的后面元素
    timer = peek(timerQueue) as Task;
  }
}

/** 倒计时到点了 */
function handleTimeout(currentTime: number) {
  isHostTimeoutScheduled = false;
  advanceTimers(currentTime);

  if (!isHostCallbackScheduled) {
    // 如果当前线程没有正在调度任务
    if (peek(taskQueue) !== null) {
      // taskQueue 有任务可调度
      isHostCallbackScheduled = true;
      requestHostCallback(flushWork);
    } else {
      // taskQueue 没有任务可调度，到 timerQueue 中找
      const firstTimer: Task = peek(timerQueue) as Task; // 到 timerQueue 中找
      if (firstTimer !== null) {
        requestHostTimeout(handleTimeout, firstTimer.startTime - currentTime);
      }
    }
  }
}

// todo
/** 主线程开始调度任务 */
function requestHostCallback(callback: Callback) {
  scheduledHostCallback = callback;

  if (!isMessageLoopRunning) {
    isMessageLoopRunning = true;
    schedulePerformWorkUntilDeadline();
  }
}

const performWorkUntilDeadline = () => {
  if (scheduledHostCallback !== null) {
    const currentTime = getCurrentTime();

    // Keep track of the start time so we can measure how long the main thread
    // has been blocked.
    startTime = currentTime;

    const hasTimeRemaining = true;
    let hasMoreWork = true;
    try {
      hasMoreWork = scheduledHostCallback(hasTimeRemaining, currentTime);
    } finally {
      if (hasMoreWork) {
        schedulePerformWorkUntilDeadline();
      } else {
        isMessageLoopRunning = false;
        scheduledHostCallback = null;
      }
    }
  } else {
    isMessageLoopRunning = false;
  }
};

const channel = new MessageChannel();

const port = channel.port2;

channel.port1.onmessage = performWorkUntilDeadline;

schedulePerformWorkUntilDeadline = () => {
  port.postMessage(null);
};

function flushWork(hasTimeRemaining: boolean, initialTime: number) {
  isHostCallbackScheduled = false;

  if (isHostTimeoutScheduled) {
    isHostTimeoutScheduled = false;
    cancelHostTimeout();
  }

  isPerformingWork = true;

  let previousPriorityLevel = currentPriorityLevel;
  try {
    return workLoop(hasTimeRemaining, initialTime);
  } finally {
    currentTask = null;
    currentPriorityLevel = previousPriorityLevel;
    isPerformingWork = false;
  }
}

/** 在当前时间切片内循环执行任务 */
function workLoop(hasTimeRemaining: boolean, initialTime: number) {
  let currentTime = initialTime; // 设置初始值

  advanceTimers(currentTime);
  currentTask = peek(taskQueue) as Task;

  while (currentTask !== null) {
    const should = shouldYieldToHost();
    if (
      currentTask.expirationTime > currentTime &&
      (!hasTimeRemaining || should)
    ) {
      // 当前任务还没有过期，并且没有剩余时间了
      break;
    }

    const callback = currentTask.callback;
    currentPriorityLevel = currentTask.priorityLevel;
    if (isFn(callback)) {
      currentTask.callback = null;

      /** 任务是否过期 */
      const didUserCallbackTimeout = currentTask.expirationTime <= currentTime; 

      const continuationCallback = callback(didUserCallbackTimeout);

      currentTime = getCurrentTime();
      if (isFn(continuationCallback)) {
        // 任务没有执行完
        currentTask.callback = continuationCallback;
        advanceTimers(currentTime);
        return true;
      } else {
        // 任务执行完了
        if (currentTask === peek(taskQueue)) {
          pop(taskQueue);
        }
        advanceTimers(currentTime);
      }
    } else {
      // currentTask不是有效任务。 在某个地方被取消掉了 | 被执行掉了
      pop(taskQueue);
    }
    currentTask = peek(taskQueue) as Task;
  }

  // 判断还有没有其他的任务
  if (currentTask !== null) {
    // case 有任务
    return true;
  } else {
    // case 没有任务
    const firstTimer = peek(timerQueue) as Task; // 从timerQueue中取任务
    if (firstTimer !== null) {
      requestHostTimeout(handleTimeout, firstTimer.startTime - currentTime);
    }
    return false;
  }
}

/** 是否将控制权交还给主线程 */
function shouldYieldToHost() {
  const timeElapsed = getCurrentTime() - startTime;

  if (timeElapsed < frameInterval) {
    // The main thread has only been blocked for a really short amount of time;
    // smaller than a single frame. Don't yield yet.
    return false;
  }

  return true;
}

/* 任务入口 */
export function scheduleCallback(
  priorityLevel: PriorityLevel,
  callback: Callback,
  options?: { delay: number }
) {
  /** 1. 任务进入调度器的时间 */
  const currentTime = getCurrentTime(); // 获取当前 performance.now() 的时间
  /** 2. 任务开始排队时间 (任务开始调度的理论时间) */
  let startTime: number;

  if (isObject(options) && options !== null) {
    /** 任务延迟时间 */
    let delay = options?.delay;
    if (typeof delay === 'number' && delay > 0) {
      // case1 需要延后排队
      startTime = currentTime + delay; // 任务开始调度的时间 = 任务进入调度器的时间 + 延迟时间
    } else {
      startTime = currentTime; // 边缘错误处理
    }
  } else {
    // case2 不需要延后排队
    startTime = currentTime;
  }

  /** 等待时间 */
  const timeout = getTimeoutByPriorityLevel(priorityLevel); // `等待时间`和`任务优先级`有关系。你的银行卡的级别越高，等待时间越短
  /** 过期时间：银行开始服务你的时间。 过期时间 = 任务开始调度的时间 + 等待时间*/
  const expirationTime = startTime + timeout; // 过期时间 = 任务开始调度的时间 + 等待时间

  // 创建一个任务
  const newTask = {
    id: taskIdCounter++,
    callback,
    priorityLevel, // 任务等级
    startTime, // 任务开始排队时间 (开始调度时间)
    expirationTime, // 排队结束时间
    sortIndex: -1, // 初始默认值 -1
  };

  if (startTime > currentTime) {
    // case1 设置了`delay`时间，有延迟的的任务
    newTask.sortIndex = startTime; // sortIndex 设置为 任务开始调度的时间
    push(timerQueue, newTask);
    if (peek(taskQueue) === null && newTask === peek(timerQueue)) {
      // 立即执行任务队列为空 && 当前任务为延迟任务的堆顶元素

      if (isHostTimeoutScheduled) {
        cancelHostTimeout(); // 取消倒计时
      } else {
        isHostTimeoutScheduled = true;
      }
      requestHostTimeout(handleTimeout, startTime - currentTime);
    }
  } else {
    // case2 没有延迟的任务
    newTask.sortIndex = expirationTime; // 任务过期时间
    push(taskQueue, newTask);

    if (!isHostCallbackScheduled && !isPerformingWork) {
      isHostCallbackScheduled = true;
      requestHostCallback(flushWork);
    }
  }
}

// 取消任务
export function cancelCallback(task: Task) {
  // Null out the callback to indicate the task has been canceled. (Can't
  // remove from the queue because you can't remove arbitrary nodes from an
  // array based heap, only the first one.)
  // 取消任务，不能直接删除，因为最小堆中只能删除堆顶元素
  task.callback = null;
}

// 获取当前任务优先级
export function getCurrentPriorityLevel(): PriorityLevel {
  return currentPriorityLevel;
}

export function requestPaint() {
  // if (
  //   enableIsInputPending &&
  //   navigator !== undefined &&
  //   // $FlowFixMe[prop-missing]
  //   navigator.scheduling !== undefined &&
  //   // $FlowFixMe[incompatible-type]
  //   navigator.scheduling.isInputPending !== undefined
  // ) {
  //   needsPaint = true;
  // }
  // Since we yield every frame regardless, `requestPaint` has no effect.
}

// heap中谁的任务优先级最高先去执行谁，这里说的“任务优先级”不是priorityLevel
