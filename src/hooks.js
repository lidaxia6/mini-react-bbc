import { scheduleUpdateOnFiber } from './ReactFiberWorkLoop';
import { areHookInputsEqual, HookLayout, HookPassive } from './utils';

let currentlyRenderingFiber = null;
let workInProgressHook = null;

// 老hook
let currentHook = null;

export function renderWithHooks(wip) {
  currentlyRenderingFiber = wip;
  currentlyRenderingFiber.memorizedState = null;
  workInProgressHook = null;

  // 为了方便，useEffect与useLayoutEffect区分开，并且以数组管理
  // 源码中是放一起的，并且是个链表
  currentlyRenderingFiber.updateQueueOfEffect = [];
  currentlyRenderingFiber.updateQueueOfLayout = [];
}

function updateWorkInProgressHook() {
  let hook;

  const current = currentlyRenderingFiber.alternate;
  if (current) {
    // 组件更新
    currentlyRenderingFiber.memorizedState = current.memorizedState;
    if (workInProgressHook) {
      hook = workInProgressHook.next;
      workInProgressHook = workInProgressHook.next;

      currentHook = currentHook.next;
    }

    if (!workInProgressHook) {
      // hook0
      hook = currentlyRenderingFiber.memorizedState;
      workInProgressHook = currentlyRenderingFiber.memorizedState;
      
      currentHook = current.memorizedState;
    }
  }

  if (!current) {
    // 组件初次渲染
    currentHook = null;

    hook = {
      memorizedState: null, // state effect
      next: null, // 下一个hook
    };
    if (workInProgressHook) {
      workInProgressHook = workInProgressHook.next = hook;
    }

    if (!workInProgressHook) {
      // hook0
      workInProgressHook = currentlyRenderingFiber.memorizedState = hook;
    }
  }

  return hook;
}

export function useReducer(reducer, initalState) {
  const hook = updateWorkInProgressHook();

  if (!currentlyRenderingFiber.alternate) {
    // 初次渲染
    hook.memorizedState = initalState;
  }

  //   let dispatch = store.dispatch;
  //   const midApi = {
  //     getState: store.getState(),
  //     // dispatch,
  //     dispatch: (action, ...args) => dispatch(action, ...args),
  //   };
  //   dispatch
  //   const dispatch = () => {
  //     hook.memorizedState = reducer(hook.memorizedState);
  //     currentlyRenderingFiber.alternate = { ...currentlyRenderingFiber };
  //     scheduleUpdateOnFiber(currentlyRenderingFiber);
  //     console.log("log"); //sy-log
  //   };

  const dispatch = dispatchReducerAction.bind(
    null,
    currentlyRenderingFiber,
    hook,
    reducer
  );

  return [hook.memorizedState, dispatch];
}

function dispatchReducerAction(fiber, hook, reducer, action) {
  hook.memorizedState = reducer
    ? reducer(hook.memorizedState, action)
    : typeof action === 'function'
    ? action(hook.memorizedState)
    : action;
  fiber.alternate = { ...fiber };
  fiber.sibling = null;
  scheduleUpdateOnFiber(fiber);
}

export function useState(initalState) {
  return useReducer(null, initalState);
}

function updateEffectImp(hooksFlags, create, deps) {
  const hook = updateWorkInProgressHook();

  // 如果屏幕上的hook存在，说明是`更新阶段`
  if (currentHook) {
    const prevEffect = currentHook.memorizedState;
    if (deps) {
      const prevDeps = prevEffect.deps;
      // 比较前后 deps 是否相同
      if (areHookInputsEqual(deps, prevDeps)) {
        return;
      }
    }
  }

  const effect = { hooksFlags, create, deps };

  hook.memorizedState = effect;

  if (hooksFlags & HookPassive) {
    currentlyRenderingFiber.updateQueueOfEffect.push(effect);
  } else if (hooksFlags & HookLayout) {
    currentlyRenderingFiber.updateQueueOfLayout.push(effect);
  }
}

export function useEffect(create, deps) {
  return updateEffectImp(HookPassive, create, deps);
}

export function useLayoutEffect(create, deps) {
  return updateEffectImp(HookLayout, create, deps);
}
