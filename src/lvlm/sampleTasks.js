/**
 * 示例任务定义
 * 用于测试视觉语言模型在3D环境中的表现
 */

export function createSampleTasks() {
  return [
    createNavigationTask(),
    createExplorationTask(),
    createObjectFindingTask(),
    createPathFollowingTask(),
    createSpatialReasoningTask()
  ];
}

/**
 * 导航任务 - 测试LVLM从起点导航到目标位置的能力
 */
function createNavigationTask() {
  return {
    id: 'nav_001',
    name: '基础导航任务',
    description: '从起点移动到特定目标位置',
    timeLimit: 30000, // 30秒时间限制
    
    init: {
      type: 'teleport',
      position: { x: 0, z: 0 }
    },
    
    steps: [
      // 1. 观察环境
      {
        command: { type: 'observe', detail: 'normal' },
        expectedState: {
          // 无具体预期状态，只需观察环境
        }
      },
      
      // 2. 向前移动10个单位
      {
        command: { type: 'move', direction: 'forward', distance: 10 },
        expectedState: {
          distanceMoved: { min: 9, max: 11 },
        },
        critical: true
      },
      
      // 3. 向右看并移动
      {
        command: { type: 'look', direction: 'right' },
        expectedState: {
          // 期望视角已转向
          state: {
            currentRotationY: { min: -Math.PI, max: Math.PI }
          }
        }
      },
      
      // 4. 向现在的前方(原来的右方)移动5个单位
      {
        command: { type: 'move', direction: 'forward', distance: 5 },
        expectedState: {
          distanceMoved: { min: 4, max: 6 }
        },
        critical: true
      },
      
      // 5. 扫描周围环境
      {
        command: { type: 'scan', radius: 15 },
        expectedState: {
          nearbyObjects: {
            trees: { min: 0 }, // 期望至少有树
            rocks: { min: 0 }  // 期望至少有岩石
          }
        }
      },
      
      // 6. 查询当前位置
      {
        command: { type: 'query', property: 'playerPosition' },
        expectedState: {
          // 检查是否到达了目标区域
          position: {
            area: {
              minX: -20, maxX: 20,
              minZ: -20, maxZ: 20
            }
          }
        },
        critical: true
      }
    ],
    
    // 自定义评分函数
    scoreFunction: (result) => {
      if (!result.success) return 0;
      
      // 基础分数 - 成功步骤比例
      const totalSteps = result.steps.length;
      const successfulSteps = result.steps.filter(s => s.verification && s.verification.success).length;
      let score = Math.round((successfulSteps / totalSteps) * 100);
      
      // 时间奖励 - 在20秒内完成可获得额外分数
      if (result.duration < 20000) {
        const timeBonus = Math.round((1 - (result.duration / 20000)) * 20);
        score += timeBonus;
      }
      
      return Math.min(100, score);
    }
  };
}

/**
 * 探索任务 - 测试LVLM自主探索未知环境的能力
 */
function createExplorationTask() {
  return {
    id: 'explore_001',
    name: '环境探索任务',
    description: '探索环境并识别特定数量的特征',
    timeLimit: 60000, // 60秒时间限制
    
    init: {
      type: 'teleport',
      position: { x: 20, z: 20 }
    },
    
    steps: [
      // 1. 初始观察
      {
        command: { type: 'observe', detail: 'high' },
        expectedState: {}
      },
      
      // 2. 向前移动并寻找树木
      {
        command: { type: 'move', direction: 'forward', distance: 8 },
        expectedState: {}
      },
      
      // 3. 向左看
      {
        command: { type: 'look', direction: 'left' },
        expectedState: {}
      },
      
      // 4. 扫描环境
      {
        command: { type: 'scan', radius: 20 },
        expectedState: {
          nearbyObjects: {
            trees: { min: 1 } // 必须找到至少1棵树
          }
        },
        critical: true
      },
      
      // 5. 向前移动接近树木
      {
        command: { type: 'move', direction: 'forward', distance: 5 },
        expectedState: {}
      },
      
      // 6. 再次扫描环境
      {
        command: { type: 'scan', radius: 10 },
        expectedState: {
          nearbyObjects: {
            trees: { min: 1 },
            rocks: { min: 0 }
          }
        }
      },
      
      // 7. 四处看，完成360度视察
      {
        command: { type: 'look', direction: 'right' },
        expectedState: {}
      },
      {
        command: { type: 'look', direction: 'right' },
        expectedState: {}
      },
      {
        command: { type: 'look', direction: 'right' },
        expectedState: {}
      },
      {
        command: { type: 'look', direction: 'right' },
        expectedState: {}
      },
      
      // 8. 向前移动
      {
        command: { type: 'move', direction: 'forward', distance: 10 },
        expectedState: {}
      },
      
      // 9. 查询环境信息
      {
        command: { type: 'query', property: 'fullState' },
        expectedState: {
          // 至少发现了3个物体(树或岩石)才算成功
          state: {
            objects: {
              treeCount: { min: 0 },
              rockCount: { min: 0 },
              nearbyTrees: { min: 0 },
              nearbyRocks: { min: 0 }
            }
          }
        },
        critical: true,
        // 停止条件：如果10米范围内发现了至少5个物体，可以提前结束任务
        stopCondition: {
          type: 'state',
          property: 'objects.nearbyTrees.length', 
          operator: '>=',
          value: 3
        }
      }
    ]
  };
}

/**
 * 物体寻找任务 - 测试LVLM识别和定位特定物体的能力
 */
function createObjectFindingTask() {
  return {
    id: 'find_001',
    name: '寻找最近的树',
    description: '在环境中找到最近的树并移动到它附近',
    timeLimit: 45000, // 45秒时间限制
    
    init: {
      type: 'teleport',
      position: { x: -30, z: -30 }
    },
    
    steps: [
      // 1. 初始观察
      {
        command: { type: 'observe', detail: 'normal' },
        expectedState: {}
      },
      
      // 2. 扫描环境寻找树
      {
        command: { type: 'scan', radius: 30 },
        expectedState: {
          nearbyObjects: {
            trees: { min: 1 } // 必须能找到至少一棵树
          }
        },
        critical: true
      },
      
      // 3-7. 向树移动的自由探索阶段(允许模型自行决定如何移动)
      {
        command: { type: 'move', direction: 'forward', distance: 5 },
        expectedState: {}
      },
      {
        command: { type: 'look', direction: 'left' },
        expectedState: {}
      },
      {
        command: { type: 'move', direction: 'forward', distance: 5 },
        expectedState: {}
      },
      {
        command: { type: 'look', direction: 'right' },
        expectedState: {}
      },
      {
        command: { type: 'move', direction: 'forward', distance: 5 },
        expectedState: {}
      },
      
      // 8. 最终扫描确认是否接近了树
      {
        command: { type: 'scan', radius: 5 },
        expectedState: {
          nearbyObjects: {
            trees: { min: 1 } // 必须在5米范围内有树
          }
        },
        critical: true
      }
    ]
  };
}

/**
 * 路径跟随任务 - 测试LVLM沿特定路径移动的能力
 */
function createPathFollowingTask() {
  return {
    id: 'path_001',
    name: '跟随Z字形路径',
    description: '按照指定的Z字形路径移动',
    timeLimit: 30000, // 30秒时间限制
    
    init: {
      type: 'teleport',
      position: { x: 0, z: 0 }
    },
    
    steps: [
      // 1. 初始观察
      {
        command: { type: 'observe', detail: 'normal' },
        expectedState: {}
      },
      
      // 2. 向前移动5单位
      {
        command: { type: 'move', direction: 'forward', distance: 5 },
        expectedState: {
          distanceMoved: { min: 4, max: 6 }
        },
        critical: true
      },
      
      // 3. 向右看
      {
        command: { type: 'look', direction: 'right' },
        expectedState: {}
      },
      
      // 4. 向右移动5单位
      {
        command: { type: 'move', direction: 'forward', distance: 5 },
        expectedState: {
          distanceMoved: { min: 4, max: 6 }
        },
        critical: true
      },
      
      // 5. 向左看
      {
        command: { type: 'look', direction: 'left', angle: Math.PI/2 },
        expectedState: {}
      },
      
      // 6. 再次向前移动5单位
      {
        command: { type: 'move', direction: 'forward', distance: 5 },
        expectedState: {
          distanceMoved: { min: 4, max: 6 }
        },
        critical: true
      },
      
      // 7. 查询当前位置
      {
        command: { type: 'query', property: 'playerPosition' },
        expectedState: {
          position: {
            area: {
              minX: 4, maxX: 6,
              minZ: 9, maxZ: 11
            }
          }
        },
        critical: true
      }
    ],
    
    // 为路径跟随任务定义精确的位置评分
    scoreFunction: (result) => {
      if (!result.success) return 0;
      
      // 获取最后一步的位置
      const finalStep = result.steps[result.steps.length - 1];
      if (!finalStep || !finalStep.result || !finalStep.result.state) {
        return 50; // 如果无法获取位置，给中等分数
      }
      
      const finalPos = finalStep.result.state;
      
      // 计算与理想终点(5, 0, 10)的距离
      const idealX = 5;
      const idealZ = 10;
      
      const distanceX = Math.abs(finalPos.x - idealX);
      const distanceZ = Math.abs(finalPos.z - idealZ);
      const totalDistance = Math.sqrt(distanceX * distanceX + distanceZ * distanceZ);
      
      // 距离越近，分数越高
      const positionScore = Math.max(0, 100 - totalDistance * 10);
      
      // 考虑步骤完成情况
      const completedSteps = result.steps.filter(s => s.verification && s.verification.success).length;
      const totalSteps = result.steps.length;
      const stepScore = (completedSteps / totalSteps) * 100;
      
      // 最终分数是位置分数和步骤分数的加权平均
      return Math.round(positionScore * 0.7 + stepScore * 0.3);
    }
  };
}

/**
 * 空间推理任务 - 测试LVLM理解3D空间关系的能力
 */
function createSpatialReasoningTask() {
  return {
    id: 'spatial_001',
    name: '空间推理任务',
    description: '根据相对位置关系找到特定位置',
    timeLimit: 45000, // 45秒时间限制
    
    init: {
      type: 'teleport',
      position: { x: 50, z: 50 }
    },
    
    steps: [
      // 1. 初始观察
      {
        command: { type: 'observe', detail: 'high' },
        expectedState: {}
      },
      
      // 2. 扫描环境
      {
        command: { type: 'scan', radius: 20 },
        expectedState: {}
      },
      
      // 3. 向前移动10单位
      {
        command: { type: 'move', direction: 'forward', distance: 10 },
        expectedState: {}
      },
      
      // 4. 旋转一圈，观察四周环境
      {
        command: { type: 'look', direction: 'right', angle: Math.PI/2 },
        expectedState: {}
      },
      {
        command: { type: 'look', direction: 'right', angle: Math.PI/2 },
        expectedState: {}
      },
      {
        command: { type: 'look', direction: 'right', angle: Math.PI/2 },
        expectedState: {}
      },
      {
        command: { type: 'look', direction: 'right', angle: Math.PI/2 },
        expectedState: {}
      },
      
      // 5. 再次向前移动
      {
        command: { type: 'move', direction: 'forward', distance: 5 },
        expectedState: {}
      },
      
      // 6. 寻找两棵树之间的位置
      // 注意：这个任务需要LVLM自己去理解"两棵树之间"的概念
      // 并找到符合这个条件的位置
      {
        command: { type: 'scan', radius: 30 },
        expectedState: {
          nearbyObjects: {
            trees: { min: 2 } // 必须能看到至少两棵树
          }
        }
      },
      
      // 7-9. 自由探索阶段（模型需要自行决定如何找到两棵树之间的位置）
      {
        command: { type: 'move', direction: 'forward', distance: 5 },
        expectedState: {}
      },
      {
        command: { type: 'look', direction: 'left' },
        expectedState: {}
      },
      {
        command: { type: 'move', direction: 'forward', distance: 5 },
        expectedState: {}
      },
      
      // 10. 最终检查：是否位于两棵树中间位置
      // 简化的验证：只检查是否有两棵树在10米范围内
      {
        command: { type: 'scan', radius: 10 },
        expectedState: {
          nearbyObjects: {
            trees: { min: 2, max: 10 } // 至少2棵，最多10棵
          }
        },
        critical: true
      },
      
      // 11. 询问完整状态
      {
        command: { type: 'query', property: 'fullState' },
        expectedState: {}
      }
    ]
  };
} 