# Three.js 开放世界游戏原型

这是一个使用Three.js构建的开放世界游戏原型，专为初学者设计。项目包含基本的地形生成、玩家控制、碰撞系统和光照效果，适合想要入门3D游戏开发但没有深厚3D知识背景的新手学习。

## 学习价值

如果你是游戏开发新手，本项目可以帮助你学习以下内容：

- 3D游戏的基本结构和组件
- 如何使用Three.js创建3D场景
- 第一人称控制器的实现原理
- 基本的物理和碰撞系统
- 程序化地形生成
- 3D对象的创建和管理
- 游戏循环和状态更新

## 功能特性

- 基于噪声函数的程序化地形生成
- 第一人称相机控制系统
- 完整的物理和碰撞系统
  - 与地形的碰撞检测
  - 与环境物体（树木、岩石）的碰撞检测
  - 能够站立在物体上方
- 树木和岩石等环境元素
- 日光和环境光照系统
- 站立、下蹲和跳跃功能
- 加载进度显示和调试工具

## 项目结构

```
/
├── src/                    # 源代码目录
│   ├── main.js             # 主入口文件，初始化场景和游戏循环
│   ├── Player.js           # 玩家类，处理输入和物理
│   ├── World.js            # 世界类，处理地形和物体生成
│   └── utils/              # 工具函数目录
│       ├── debug.js        # 调试工具类
│       └── loadingManager.js # 资源加载管理器
├── index.html              # HTML入口文件
└── package.json            # 项目依赖配置
```

## 核心组件说明

### 1. 主入口 (main.js)

主入口文件负责初始化Three.js场景、相机、渲染器和灯光。它还设置了游戏循环，这是游戏运行的心脏。

游戏循环的主要任务：
- 更新玩家位置和状态
- 更新世界中的物体
- 处理用户输入
- 渲染场景

### 2. 玩家控制 (Player.js)

玩家控制系统实现了第一人称视角的移动和交互，包括：
- WASD/方向键移动
- 鼠标视角控制
- 跳跃和下蹲功能
- 与环境的碰撞检测

玩家物理系统模拟了：
- 重力和跳跃
- 地面摩擦
- 与物体的碰撞和反弹

### 3. 世界生成 (World.js)

世界生成系统负责创建游戏环境，包括：
- 使用Simplex噪声函数生成自然地形
- 放置树木和岩石等环境物体
- 管理碰撞对象列表
- 创建天空和环境效果

### 4. 工具类

- **debug.js**: 提供游戏状态可视化，帮助开发和调试
- **loadingManager.js**: 管理资源加载过程，显示加载进度

## 游戏运行机制

### 初始化流程

1. 创建Three.js场景、相机和渲染器
2. 设置光照系统（环境光和方向光）
3. 初始化世界并生成地形和物体
4. 创建玩家并设置控制器
5. 启动游戏循环

### 游戏循环

游戏每帧执行以下操作：
1. 计算时间增量（delta）
2. 处理玩家输入并更新位置
3. 检测并处理碰撞
4. 更新世界状态
5. 渲染场景
6. 更新调试信息（如果开启）

## 关键代码解析

### 场景设置

```javascript
// 创建场景
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // 天空蓝

// 创建相机
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// 创建渲染器
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
```

### 地形生成

```javascript
// 使用噪声函数生成高度
const height = 
    this.noise.noise(nx * 1, nz * 1) * 0.5 + 
    this.noise.noise(nx * 2, nz * 2) * 0.3 +
    this.noise.noise(nx * 4, nz * 4) * 0.2;
```

### 玩家移动

```javascript
// 计算移动方向
this.direction.set(0, 0, 0);
if (this.keys.forward) this.direction.z = -1;
if (this.keys.backward) this.direction.z = 1;
if (this.keys.left) this.direction.x = -1;
if (this.keys.right) this.direction.x = 1;

// 应用相机朝向
const rotationMatrix = new THREE.Matrix4();
rotationMatrix.makeRotationY(this.yawObject.rotation.y);
this.direction.applyMatrix4(rotationMatrix);
```

### 碰撞检测

```javascript
// 检查碰撞
const minDistance = this.radius + collisionRadius;
if (distance < minDistance) {
    // 计算推力方向
    const pushDirection = new THREE.Vector2()
        .subVectors(playerPosition, objectPosition)
        .normalize()
        .multiplyScalar(minDistance - distance);
    
    // 应用推力
    this.position.x += pushDirection.x;
    this.position.z += pushDirection.y;
}
```

## 运行项目

1. 克隆项目
```
git clone <项目地址>
cd threejs-open-world
```

2. 安装依赖
```
npm install
```

3. 启动开发服务器
```
npm run dev
```

4. 在浏览器中打开 http://localhost:5173

## 控制说明

- WASD或方向键 - 移动
- 鼠标 - 视角控制
- 空格键 - 跳跃（可以跳到岩石和树木上面）
- Shift键 - 下蹲
- 点击游戏窗口 - 锁定鼠标指针（按ESC解除锁定）
- Ctrl+D - 切换调试信息显示
- H键 - 切换游戏控制提示显示

## 相机控制系统

本项目实现了一个层次化的第一人称相机控制系统，由三个主要部分组成：

### 对象层次结构

1. **yawObject（偏航对象）**：
   - 最顶层对象，控制左右旋转（绕Y轴）
   - 相当于玩家的整个身体
   - 位置等同于玩家在世界中的位置

2. **pitchObject（俯仰对象）**：
   - yawObject的子对象，控制上下旋转（绕X轴）
   - 相当于玩家的头部
   - Y轴位置设为2，模拟头部高度

3. **camera（相机）**：
   - pitchObject的子对象
   - 相当于玩家的眼睛
   - 位置设为原点(0,0,0)，位于pitchObject中心

### 运作原理

- **左右看（水平旋转）**：
  旋转yawObject的Y轴，整个系统（包括相机）跟随旋转
  
- **上下看（垂直旋转）**：
  旋转pitchObject的X轴，垂直视角受限于-90°到90°，防止过度旋转
  
- **移动**：
  通过WASD控制，移动方向与相机朝向同步，实现自然的第一人称控制

## 碰撞系统

本项目实现了一个多层次的碰撞检测系统，用于处理玩家与环境之间的物理交互：

### 碰撞检测类型

1. **地形碰撞**：
   - 使用地形高度图进行精确的高度检测
   - 确保玩家不会穿透地面
   - 支持不同地形高度的自然过渡

2. **环境物体碰撞**：
   - 基于简单的圆柱体碰撞模型
   - 为不同类型的物体（树木、岩石）设置不同的碰撞半径
   - 当发生侧向碰撞时，施加推力将玩家推开

3. **物体站立功能**：
   - 允许玩家跳跃到环境物体上方
   - 为不同物体类型计算准确的顶部高度
   - 实现与地面类似的站立体验

### 碰撞处理流程

1. **收集可碰撞对象**：
   - 世界类（World）生成并维护可碰撞物体列表
   - 包含物体类型、位置、尺寸等碰撞相关参数

2. **检测优先级**：
   - 首先检查玩家是否站在物体上方
   - 然后检查玩家是否接触地面
   - 最后检查是否与物体发生侧向碰撞

3. **碰撞响应**：
   - 对垂直碰撞：调整高度并停止下落
   - 对水平碰撞：计算推力方向，防止穿透

## 对新手的学习建议

1. **浏览代码顺序**：先查看main.js，了解整体结构，然后深入Player.js和World.js

2. **动手尝试**：
   - 调整地形生成参数，查看效果变化
   - 修改玩家移动速度和跳跃高度
   - 添加新的环境物体

3. **渐进式学习**：
   - 先理解场景、相机和渲染器的基本概念
   - 然后学习如何创建和操作3D对象
   - 最后深入碰撞检测和物理系统

4. **实用改进项目**：
   - 添加简单的UI（如生命值、计分器）
   - 增加物品收集功能
   - 实现简单的敌人AI

## 技术栈

- Three.js - 3D图形库
- JavaScript - 编程语言
- Vite - 构建工具和开发服务器

## 未来计划

- 添加更多环境变化（如白天/黑夜循环）
- 改进地形生成算法
- 添加水体和其他景观特性
- 添加更多互动元素
- 优化性能和加载时间
- 增强碰撞系统，支持更多复杂形状
- 添加不同表面的特殊效果（如滑动、弹跳等） 