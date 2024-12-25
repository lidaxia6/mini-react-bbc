import { createFiber } from './ReactFiber';
import { isArray, isStringOrNumber, Placement, Update } from './utils';

// returnFiber.deletions = [a,b,c]
function deleteChild(returnFiber, childToDelete) {
  const deletions = returnFiber.deletions;
  if (deletions) {
    returnFiber.deletions.push(childToDelete);
  } else {
    returnFiber.deletions = [childToDelete];
  }
}

function deleteRemainingChildren(returnFiber, currentFirstChild) {
  let childToDelete = currentFirstChild;

  while (childToDelete) {
    deleteChild(returnFiber, childToDelete);
    childToDelete = childToDelete.sibling;
  }
}

// 初次渲染，只是记录下标
// 更新，检查节点是否移动
/**
 * 作用：
 * 1. 设置 newFiber.index
 * 2. 检测出需要移动的fibre节点，并设置 newFiber.flags = Placement
 * 详见：https://ws7g4enfbn.feishu.cn/wiki/BC47wjXhfifqaFk0hOLcZCNqnce?fromScene=spaceOverview#share-WnPSd08IPouH16xikk9cmTgtn7c
 */

function placeChild(
  newFiber,
  lastPlacedIndex,
  newIndex,
  shouldTrackSideEffects
) {
  newFiber.index = newIndex; // fiber.index，记录新节点在当前层级的位置

  //case(情况) 1.如果returnFiber没有`alternate`，说明是父组件初次渲染
  if (!shouldTrackSideEffects) {
    // 父节点初次渲染
    return lastPlacedIndex;
  }

  //case(情况) 2.否则：说明是组件更新
  // 父节点更新
  // 子节点是初次渲染还是更新呢
  // ? current 是 子节点更新前的fiber节点
  const current = newFiber.alternate;

  if (current) {
    const oldIndex = current.index;
    // 子节点是更新
    // lastPlacedIndex 记录了上次dom节点的相对更新节点的最远位置
    // old 0 1 2 3 4
    // new 2 1 3 4
    // 2 1(6) 3 4

    // 用 lastPlacedIndex 去记录oldFiber链表上的最大索引
    if (oldIndex < lastPlacedIndex) {
      // 如果当前节点的旧索引值 小于 当前找到的最大旧索引值，说明：`当前节点相位置` 相对于 `旧节点位置` 发生了向后移动。
      newFiber.flags |= Placement;
      return lastPlacedIndex;
    } else {
      // 不需要移动
      return oldIndex;
    }
  }

  // 子节点是初次渲染。如：老节点没有了，新节点还有
  if (!current) {
    newFiber.flags |= Placement;
    return lastPlacedIndex;
  }
}

/**
 * 背景：
 * old  0,1,2,3
 * new  0,2,1,3
 * 遍历new  至第二次时，新老节点对比不一样，终止循环
 * 将oldFiber节点(1节点)传递给 mapRemainingChildren 方法
 *
 * 使用 Map 存储剩余老节点，然后遍历新节点寻找可复用的节点。
 */
function mapRemainingChildren(currentFirstChild) {
  const existingChildren = new Map();

  let existingChild = currentFirstChild;
  while (existingChild) {
    // key: value
    // key||index: fiber
    existingChildren.set(
      existingChild.key || existingChild.index,
      existingChild
    );
    existingChild = existingChild.sibling;
  }

  return existingChildren;
}

// 协调（diff）
// abc
// bc
/**
 * 此时returnFiber是 wip ，是上一次函数组件的fiber节点
 * children 是 执行函数type(props)的返回值
 * ? 此时的 returnFiber 和 children 有什么区别？
 * ? type(props) 得到的 children 是最新通过babel转译后的jsxElement，如 children.props.children[0].props.children 是 'new'
 * ? returnFiber 是上一次函数组件的fiber节点，此时 returnFiber.child.child.props.children 是 'old'
 */
export function reconcileChildren(returnFiber, children) {
  if (isStringOrNumber(children)) {
    return;
  }

  const newChildren = isArray(children) ? children : [children];
  /**
   * [oldFiber]
   * oldfiber的头结点
   * 1.用于获取旧的子Fiber节点
   * 2.在diff算法中用于与新的子节点进行比较
   * 3.主要用于节点的复用和更新
   * 4.是一个具体的Fiber节点引用
   */
  let oldFiber = returnFiber.alternate?.child;

  // 下一个oldFiber | 暂时缓存下一个oldFiber
  let nextOldFiber = null;

  /**
   * [ shouldTrackSideEffects = !!returnFiber.alternate ]
   * 1.用于标记是否需要追踪副作用
   * 2.如果是首次渲染（returnFiber.alternate为null），则为false
   * 3.如果是更新（returnFiber.alternate存在），则为true
   */
  let shouldTrackSideEffects = !!returnFiber.alternate;
  // 指针，用于构建fiber链表
  let previousNewFiber = null;

  // 用于遍历的一个变量
  let newIndex = 0;
  // 上一次dom节点插入的最远位置
  // 判断节点是否需要移动
  // old 0 1 2 3 4
  // new 2 1 3 4
  /**
   * ?
   * 比如遍历new
   * 第一个元素2 lastPlacedIndex = 2
   * 然后到第二个元素1，元素1需要插队，lastPlacedIndex = 1
   *
   */
  let lastPlacedIndex = 0;

  // *1. 从左边往右遍历，比较新老节点，如果节点可以复用，继续往右，否则就停止整个for循环
  /**
   * 注： oldFiber 是旧的dom节点（链表，Fiber） newChildren是新的dom节点（数组，jsxElement）*
   *
   * ------------------------------
   *
   * 示例一：
   * old: 0 1 2 3
   * new: 0 2 1 3
   *        ↑
   * 停止循环原因：新老节点不一致
   * if (!same) {
   *  ...
   *  break;
   * }
   *
   * ------------------------------
   *
   * 示例二
   * old: 0 1 2 3
   * new: 0 1 2
   *          ↑
   * 停止循环原因：newIndex < newChildren.length 不满足
   *                3            3
   *
   * ------------------------------
   *
   * 示例三
   * old: 0 1 2 3
   * new: 0 1 2 3 4
   *            ↑
   * 停止循环原因：oldFiber 为 null
   */

  // 遍历newChildren，当new:2 old:1 ,不相同，对比结束
  for (; oldFiber && newIndex < newChildren.length; newIndex++) {
    const newChild = newChildren[newIndex];

    if (newChild == null) {
      continue;
    }

    // 1. 比较dom节点顺序是否发生变化,如果顺序被打乱
    if (oldFiber.index > newIndex) {
      //? case1 当 oldFiber.index > newIndex 时：原本在后面的节点移动到了之前位置的前面，说明在这个节点之后所有的节点都不再可以复用，停止继续循环遍历。
      nextOldFiber = oldFiber; // 将当前的 oldFiber(造成顺序颠倒的Fiber节点) 保存到 nextOldFiber 中
      oldFiber = null; // 将 oldFiber 设为 null，中断遍历newChildren(外层的for循环)
    } else {
      // case2 当 oldFiber.index <= newIndex 时：nextOldFiber 指向 oldFiber.sibling
      nextOldFiber = oldFiber.sibling;
    }

    // 2. 接着比较节点是否可以复用
    const same = sameNode(newChild, oldFiber);
    // case1 比较结果是内容发生了变化
    if (!same) {
      if (oldFiber == null) {
        oldFiber = nextOldFiber;
      }
      break; // 中断上层for循环
    }

    // case2 比较结果是内容相同
    const newFiber = createFiber(newChild, returnFiber);

    // 新fiber节点复用旧fiber节点
    Object.assign(newFiber, {
      stateNode: oldFiber.stateNode,
      alternate: oldFiber,
      flags: Update,
    });

    // 节点更新
    lastPlacedIndex = placeChild(
      newFiber,
      lastPlacedIndex,
      newIndex,
      shouldTrackSideEffects
    );

    if (previousNewFiber == null) {
      returnFiber.child = newFiber;
    } else {
      previousNewFiber.sibling = newFiber;
    }

    previousNewFiber = newFiber;
    oldFiber = nextOldFiber;
  }

  // *2. 新节点没了，老节点还有；新节点删除
  // newChildren 遍历完了，将oldFiber链表的剩余节点删除
  // 示例：
  // old: 0 1 2 3 4
  // new: 0 1 2 3
  // 结果：删除 4
  // https://ws7g4enfbn.feishu.cn/wiki/BC47wjXhfifqaFk0hOLcZCNqnce?fromScene=spaceOverview#share-COeYdYxibofmkexQhP4cGCxqnDf
  if (newIndex === newChildren.length) {
    deleteRemainingChildren(returnFiber, oldFiber);
    return;
  }

  // *3. 老节点没了，新节点还有；
  // 1）初次渲染
  // 2）老节点没了，新节点还有  [0, 1, 2, 3] -> [0, 1, 2, 3, insert]
  // 详细解释：https://ws7g4enfbn.feishu.cn/wiki/BC47wjXhfifqaFk0hOLcZCNqnce?fromScene=spaceOverview#share-QQWMdvPnvoMUiAxSfBocshKznn9
  if (oldFiber == null) {
    // 遍历
    for (; newIndex < newChildren.length; newIndex++) {
      const newChild = newChildren[newIndex];
      if (newChild == null) {
        continue;
      }
      const newFiber = createFiber(newChild, returnFiber);

      lastPlacedIndex = placeChild(
        newFiber,
        lastPlacedIndex,
        newIndex,
        shouldTrackSideEffects
      );

      // 构建fiber链表
      if (previousNewFiber === null) {
        // head node
        returnFiber.child = newFiber;
      } else {
        previousNewFiber.sibling = newFiber;
      }
      previousNewFiber = newFiber;
    }
  }

  // *4 新老节点都还有
  // 小而乱
  // old 0 1 [2 3 4]
  // new 0 1 [3 4]
  // !4.1 把剩下的old单链表构建哈希表
  const existingChildren = mapRemainingChildren(oldFiber);

  // !4.2 遍历新节点，通过新节点的key去哈希表中查找节点，找到就复用节点，并且删除哈希表中对应的节点
  for (; newIndex < newChildren.length; newIndex++) {
    const newChild = newChildren[newIndex];
    if (newChild == null) {
      continue;
    }
    const newFiber = createFiber(newChild, returnFiber);

    // oldFiber
    const matchedFiber = existingChildren.get(newFiber.key || newFiber.index);
    if (matchedFiber) {
      // 节点复用
      Object.assign(newFiber, {
        stateNode: matchedFiber.stateNode,
        alternate: matchedFiber,
        flags: Update,
      });
      // 删除哈希表中对应的节点
      existingChildren.delete(newFiber.key || newFiber.index);
    }

    lastPlacedIndex = placeChild(
      newFiber,
      lastPlacedIndex,
      newIndex,
      shouldTrackSideEffects
    );

    // 构建fiber链表
    if (previousNewFiber == null) {
      returnFiber.child = newFiber;
    } else {
      previousNewFiber.sibling = newFiber;
    }
    previousNewFiber = newFiber;
  }

  // *5 old的哈希表中还有值，遍历哈希表删除所有old
  if (shouldTrackSideEffects) {
    existingChildren.forEach((child) => deleteChild(returnFiber, child));
  }
}

// 节点复用的条件：1. 同一层级下 2. 类型相同 3. key相同
function sameNode(a, b) {
  return a && b && a.type === b.type && a.key === b.key;
}
