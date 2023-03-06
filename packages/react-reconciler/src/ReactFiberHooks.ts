import {scheduleUpdateOnFiber} from "./ReactFiberWorkLoop";
import {Fiber, FiberRoot} from "./ReactInternalTypes";
import {HostRoot} from "./ReactWorkTags";

type Hook = {
  memorizedState: any; // state
  next: Hook | null; // 下一个hook
};
let currentlyRenderingFiber: Fiber = null;
let workInProgressHook: Hook = null;

// 获取当前正在执行的函数组件的fiber
export function renderHooks(workInProgress: Fiber) {
  currentlyRenderingFiber = workInProgress;
  workInProgressHook = null;
}

function updateWorkInProgressHook(): Hook {
  let hook: Hook;

  const current = currentlyRenderingFiber.alternate;
  if (current) {
    currentlyRenderingFiber.memoizedState = current.memoizedState;
    if (workInProgressHook) {
      workInProgressHook = hook = workInProgressHook.next;
    } else {
      hook = workInProgressHook = currentlyRenderingFiber.memoizedState;
    }
    // 更新
  } else {
    // 初次渲染
    hook = {
      memorizedState: null,
      next: null,
    };

    if (workInProgressHook) {
      workInProgressHook = workInProgressHook.next = hook;
    } else {
      // hook0
      workInProgressHook = currentlyRenderingFiber.memoizedState = hook;
    }
  }
  return hook;
}

export function useReducer(reducer: Function, initialState: any) {
  const hook = updateWorkInProgressHook();

  if (!currentlyRenderingFiber.alternate) {
    // 函数组件初次渲染
    hook.memorizedState = initialState;
  }
  const dispatch = (action) => {
    hook.memorizedState = reducer(hook.memorizedState, action);

    const root = getRootForUpdatedFiber(currentlyRenderingFiber);

    currentlyRenderingFiber.alternate = {...currentlyRenderingFiber};

    scheduleUpdateOnFiber(root, currentlyRenderingFiber);
  };

  return [hook.memorizedState, dispatch];
}

// 根据 sourceFiber 找根节点
function getRootForUpdatedFiber(sourceFiber: Fiber): FiberRoot {
  let node = sourceFiber;
  let parent = node.return;

  while (parent !== null) {
    node = parent;
    parent = node.return;
  }

  return node.tag === HostRoot ? node.stateNode : null;
}