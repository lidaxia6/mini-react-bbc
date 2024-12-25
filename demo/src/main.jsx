// import React from "react";
// import ReactDOM from "react-dom";
// import {  useReducer } from "react";
import {
  ReactDOM,
  Component,
  useReducer,
  useState,
  useEffect,
  useLayoutEffect,
} from '../which-react';

import './index.css';

function FunctionComponent(props) {
  const [count, setCount] = useReducer((x) => x + 1, 0);
  const [count2, setCount2] = useState(0);

  useEffect(() => {
    console.log('omg useEffect', count2); //sy-log
  }, [count2]);

  useLayoutEffect(() => {
    console.log('omg useLayoutEffect', count2); //sy-log
  }, [count2]);

  return (
    <div className="border">
      <p>{props.name}</p>
      <button onClick={() => setCount()}>{count}</button>
      <button
        onClick={() => {
          setCount2(count2 + 1);
        }}
      >
        {count2}
      </button>

      {count % 2 ? <div>omg</div> : <span>123</span>}

      <ul>
        {/* {count2 === 2
          ? [0, 1, 3, 4].map((item) => {
              return <li key={item}>{item}</li>;
            })
          : [0, 1, 2, 3, 4].map((item) => {
              return <li key={item}>{item}</li>;
            })} */}

        {count2 === 2
          ? [2, 1, 3, 4].map((item) => {
              return <li key={item}>{item}</li>;
            })
          : [0, 1, 2, 3, 4].map((item) => {
              return <li key={item}>{item}</li>;
            })}
      </ul>
    </div>
  );
}

class ClassComponent extends Component {
  render() {
    return (
      <div className="border">
        <h3>{this.props.name}</h3>
        我是文本
      </div>
    );
  }
}

function FragmentComponent() {
  return (
    <ul>
      <>
        <li>part1</li>
        <li>part2</li>
      </>
    </ul>
  );
}

function FunctionComponentDIFF(props) {
  const [count2, setCount2] = useState(0);
  return (
    <div className="border">
      <button
        onClick={() => {
          debugger;
          setCount2(count2 + 1);
        }}
      >
        {count2}
      </button>
      <ul>
        {/* 
          // ! 一、节点删除【老节点有，新节点没有】  [0, 1, 2, 3, 4] -> [0, 1, 2, 3]
          这里变换可以看到：
           - 初次渲染
           - 组件更新
           - diff算法 节点删除
          详解：https://ws7g4enfbn.feishu.cn/wiki/BC47wjXhfifqaFk0hOLcZCNqnce?fromScene=spaceOverview#share-COeYdYxibofmkexQhP4cGCxqnDf
        */}
        {/* {count2 === 2
          ? [0, 1, 2, 3].map((item) => {
              return <li key={item}>{item}</li>;
            })
          : [0, 1, 2, 3, 4].map((item) => {
              return <li key={item}>{item}</li>;
            })} */}

        {/* 
          // ! 二、节点末尾新增【老节点没有，新节点有】 [0, 1, 2, 3] -> [0, 1, 2, 3, insert]
        */}
        {/* {count2 === 2
          ? [0, 1, 2, 3, 4].map((item) => {
              return <li key={item}>{item}</li>;
            })
          : [0, 1, 2, 3].map((item) => {
              return <li key={item}>{item}</li>;
            })} */}

        {/* 
          // ! 三、节点调换位置 [0, 1, 2, 3] -> [0, 2, 1, 3]
        */}
        {/* {count2 === 2
          ? [0, 2, 1, 3].map((item) => {
              return <li key={item}>{item}</li>;
            })
          : [0, 1, 2, 3].map((item) => {
              return <li key={item}>{item}</li>;
            })} */}

        {/* 
          // ! 三(2)、节点中间删除 [0, 1, delete, 3] -> [0, 1, 3]
        */}
        {/* {count2 === 2
          ? [0, 1, 3].map((item) => {
              return <li key={item}>{item}</li>;
            })
          : [0, 1, 'delete', 3].map((item) => {
              return <li key={item}>{item}</li>;
            })} */}

        {/* 
          // ! 五、节点中间新增 [0, 1, 2, 3] -> [0, 1, 2, insert, 3]
        */}
        {count2 === 2
          ? [0, 1, 2, 'insert', 3].map((item, index) => {
              return <li key={item}>{item}</li>;
            })
          : [0, 1, 2, 3].map((item, index) => {
              return <li key={item}>{item}</li>;
            })}
      </ul>
    </div>
  );
}

function HookDemoUseEffect(props) {
  const [count, setCount] = useReducer((x) => x + 1, 0);
  const [count2, setCount2] = useState(0);

  useEffect(() => {
    console.log('useEffect', count);
  }, [count]);

  useLayoutEffect(() => {
    console.log('useLayoutEffect', count2);
  }, [count2]);

  return (
    <div className="border">
      <p>{props.name}</p>
      <button
        onClick={() => {
          debugger;
          setCount();
        }}
      >
        {count}
      </button>
      <button
        onClick={() => {
          debugger;
          setCount2(count2 + 1);
        }}
      >
        {count2}
      </button>
    </div>
  );
}

// const jsx = (
//   <div className="border">
//     <h1>react</h1>
//     <a href="https://github.com/bubucuo/mini-react">mini react</a>
//     <FunctionComponent name="函数组件" />
//     <ClassComponent name="类组件" />
//     <FragmentComponent />
//   </div>
// );

// const jsx = <FunctionComponentDIFF />;
const jsx = <HookDemoUseEffect name="llong" />;
ReactDOM.createRoot(document.getElementById('root')).render(jsx);

// 实现了常见组件初次渲染

// 原生标签
// 函数组件
// 类组件
// 文本
// Fragment
