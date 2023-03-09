import {createFiber} from "./ReactFiber";
import {createLaneMap, NoLane, NoLanes} from "./ReactFiberLane";
import {Container, FiberRoot} from "./ReactInternalTypes";
import {HostRoot} from "./ReactWorkTags";

export function createFiberRoot(containerInfo: Container): FiberRoot {
  const root: FiberRoot = new FiberRootNode(containerInfo);

  root.current = createFiber(HostRoot, null, null, null);
  root.current.stateNode = root;

  return root;
}

export function FiberRootNode(containerInfo) {
  this.containerInfo = containerInfo;
  // this.pendingChildren = null;
  this.current = null;
  this.finishedWork = null;
  this.callbackNode = null;

  this.callbackPriority = NoLane;
  this.eventTimes = createLaneMap(NoLanes);

  this.pendingLanes = NoLanes;
  this.pingedLanes = NoLanes;

  this.finishedLanes = NoLanes;
}
