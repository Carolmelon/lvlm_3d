import { compareImages } from './utils/compareImages.js';

/**
 * LVLM验证框架 - 用于评估视觉语言模型在3D环境中的表现
 */
export class VerificationFramework {
  constructor(lvlmInterface) {
    this.interface = lvlmInterface;
    this.tasks = [];
    this.results = [];
    this.currentTask = null;
  }
  
  /**
   * 添加验证任务
   * @param {Object} task - 任务定义
   */
  addTask(task) {
    // 确保任务有唯一ID
    if (!task.id) {
      task.id = `task_${this.tasks.length + 1}`;
    }
    
    this.tasks.push(task);
    console.log(`添加任务: ${task.id} - ${task.name}`);
    return task.id;
  }
  
  /**
   * 运行特定任务验证
   * @param {string} taskId - 任务ID
   * @returns {Object} - 任务验证结果
   */
  async runTaskVerification(taskId) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) {
      return { success: false, message: `找不到任务: ${taskId}` };
    }
    
    this.currentTask = task;
    console.log(`开始验证任务: ${task.id} - ${task.name}`);
    
    const taskResult = {
      taskId: task.id,
      name: task.name,
      steps: [],
      success: false,
      score: 0,
      startTime: Date.now(),
      endTime: null,
      duration: 0
    };
    
    try {
      // 如果有初始化步骤，先执行
      if (task.init) {
        await this.interface.executeCommand(task.init);
      }
      
      // 执行任务步骤
      for (let i = 0; i < task.steps.length; i++) {
        const step = task.steps[i];
        console.log(`执行步骤 ${i+1}/${task.steps.length}: ${step.command.type}`);
        
        const result = await this.interface.executeCommand(step.command);
        
        const stepVerification = this.verifyStep(result, step.expectedState);
        
        taskResult.steps.push({
          command: step.command,
          result: { ...result, observation: '图像数据已省略' }, // 不存储图像以节省空间
          expectedState: step.expectedState,
          verification: stepVerification
        });
        
        // 如果步骤失败且标记为关键步骤，则整个任务失败
        if (!stepVerification.success && step.critical) {
          taskResult.success = false;
          taskResult.message = `关键步骤 ${i+1} 失败: ${stepVerification.message}`;
          break;
        }
        
        // 如果有停止条件并且满足，则提前结束任务
        if (step.stopCondition && this.evaluateCondition(result, step.stopCondition)) {
          taskResult.message = `满足停止条件，在步骤 ${i+1} 后结束任务`;
          break;
        }
      }
      
      // 如果没有提前退出，检查所有关键步骤是否成功
      if (!taskResult.message) {
        const criticalSteps = taskResult.steps.filter((s, i) => 
          task.steps[i].critical
        );
        
        const allCriticalSucceeded = criticalSteps.every(s => s.verification.success);
        
        if (criticalSteps.length > 0) {
          taskResult.success = allCriticalSucceeded;
          if (allCriticalSucceeded) {
            taskResult.message = '所有关键步骤验证成功';
          } else {
            taskResult.message = '一个或多个关键步骤验证失败';
          }
        } else {
          // 如果没有定义关键步骤，则所有步骤都必须成功
          taskResult.success = taskResult.steps.every(s => s.verification.success);
          taskResult.message = taskResult.success ? 
            '所有步骤验证成功' : 
            '一个或多个步骤验证失败';
        }
      }
      
      // 计算分数
      taskResult.score = this.calculateScore(taskResult, task);
      
    } catch (error) {
      taskResult.success = false;
      taskResult.message = `任务执行出错: ${error.message}`;
      taskResult.error = error.toString();
    }
    
    taskResult.endTime = Date.now();
    taskResult.duration = taskResult.endTime - taskResult.startTime;
    
    // 保存结果
    this.results.push(taskResult);
    this.currentTask = null;
    
    console.log(`完成任务验证: ${task.id}, 成功: ${taskResult.success}, 分数: ${taskResult.score}`);
    return taskResult;
  }
  
  /**
   * 运行所有任务验证
   * @returns {Array} - 所有任务验证结果
   */
  async runAllVerifications() {
    this.results = [];
    const allResults = [];
    
    for (const task of this.tasks) {
      const result = await this.runTaskVerification(task.id);
      allResults.push(result);
    }
    
    return allResults;
  }
  
  /**
   * 验证单个步骤结果
   * @param {Object} result - 命令执行结果
   * @param {Object} expectedState - 预期状态
   * @returns {Object} - 验证结果
   */
  verifyStep(result, expectedState) {
    if (!expectedState) {
      return { success: true, message: '无预期状态，步骤默认成功' };
    }
    
    const verifications = [];
    
    // 验证状态
    if (expectedState.state) {
      const stateVerification = this.verifyState(result.state, expectedState.state);
      verifications.push({
        type: 'state',
        success: stateVerification.success,
        message: stateVerification.message
      });
    }
    
    // 验证位置
    if (expectedState.position) {
      const positionVerification = this.verifyPosition(
        result.state.currentPosition || result.state.position,
        expectedState.position
      );
      verifications.push({
        type: 'position',
        success: positionVerification.success,
        message: positionVerification.message
      });
    }
    
    // 验证距离
    if (expectedState.distanceMoved !== undefined) {
      const distanceVerification = this.verifyDistance(
        result.state.distanceMoved,
        expectedState.distanceMoved
      );
      verifications.push({
        type: 'distance',
        success: distanceVerification.success,
        message: distanceVerification.message
      });
    }
    
    // 验证图像内容
    if (expectedState.imageContains && result.observation) {
      // 这里应该使用外部图像识别API或本地计算机视觉库进行验证
      // 本示例简化处理，将图像验证标记为未实现
      verifications.push({
        type: 'image',
        success: true,
        message: '图像内容验证功能需要集成计算机视觉能力'
      });
    }
    
    // 验证范围内的对象
    if (expectedState.nearbyObjects) {
      const objectsVerification = this.verifyNearbyObjects(
        result.state.nearbyObjects,
        expectedState.nearbyObjects
      );
      verifications.push({
        type: 'objects',
        success: objectsVerification.success,
        message: objectsVerification.message
      });
    }
    
    // 确定整体结果
    const overallSuccess = verifications.every(v => v.success);
    let message = overallSuccess ? '所有验证通过' : '部分验证失败';
    
    // 收集失败消息
    if (!overallSuccess) {
      const failureMessages = verifications
        .filter(v => !v.success)
        .map(v => `${v.type}: ${v.message}`);
      message = failureMessages.join('; ');
    }
    
    return {
      success: overallSuccess,
      message: message,
      details: verifications
    };
  }
  
  /**
   * 验证状态对象
   * @param {Object} actualState - 实际状态
   * @param {Object} expectedState - 预期状态
   * @returns {Object} - 验证结果
   */
  verifyState(actualState, expectedState) {
    if (!actualState) {
      return { success: false, message: '实际状态为空' };
    }
    
    const failures = [];
    
    // 遍历预期状态的所有属性
    for (const key in expectedState) {
      if (expectedState.hasOwnProperty(key)) {
        // 如果预期值是对象，递归验证
        if (typeof expectedState[key] === 'object' && expectedState[key] !== null) {
          if (actualState[key] === undefined) {
            failures.push(`属性 ${key} 不存在`);
          } else {
            const nestedVerification = this.verifyState(actualState[key], expectedState[key]);
            if (!nestedVerification.success) {
              failures.push(`${key}: ${nestedVerification.message}`);
            }
          }
        } 
        // 如果预期值是范围
        else if (key === 'min' || key === 'max') {
          continue; // 由父对象处理
        }
        // 验证范围值
        else if (expectedState.min !== undefined || expectedState.max !== undefined) {
          const value = actualState;
          if (expectedState.min !== undefined && value < expectedState.min) {
            failures.push(`值 ${value} 小于最小值 ${expectedState.min}`);
          }
          if (expectedState.max !== undefined && value > expectedState.max) {
            failures.push(`值 ${value} 大于最大值 ${expectedState.max}`);
          }
        }
        // 直接比较值
        else if (actualState[key] !== expectedState[key]) {
          failures.push(`属性 ${key} 值不匹配: 预期 ${expectedState[key]}, 实际 ${actualState[key]}`);
        }
      }
    }
    
    return {
      success: failures.length === 0,
      message: failures.length === 0 ? '状态验证通过' : failures.join('; ')
    };
  }
  
  /**
   * 验证位置
   * @param {Object} actualPosition - 实际位置
   * @param {Object} expectedPosition - 预期位置或位置范围
   * @returns {Object} - 验证结果
   */
  verifyPosition(actualPosition, expectedPosition) {
    if (!actualPosition) {
      return { success: false, message: '实际位置为空' };
    }
    
    // 检查是否是精确位置匹配
    if (expectedPosition.x !== undefined && 
        expectedPosition.y !== undefined && 
        expectedPosition.z !== undefined) {
      
      const tolerance = expectedPosition.tolerance || 1.0; // 默认容差
      
      const xDiff = Math.abs(actualPosition.x - expectedPosition.x);
      const yDiff = Math.abs(actualPosition.y - expectedPosition.y);
      const zDiff = Math.abs(actualPosition.z - expectedPosition.z);
      
      const withinTolerance = xDiff <= tolerance && 
                              yDiff <= tolerance && 
                              zDiff <= tolerance;
      
      return {
        success: withinTolerance,
        message: withinTolerance 
          ? `位置在容差 ${tolerance} 内` 
          : `位置超出容差范围: 预期(${expectedPosition.x}, ${expectedPosition.y}, ${expectedPosition.z}), ` +
            `实际(${actualPosition.x}, ${actualPosition.y}, ${actualPosition.z})`
      };
    }
    
    // 检查是否是区域位置匹配
    if (expectedPosition.area) {
      const { minX, maxX, minY, maxY, minZ, maxZ } = expectedPosition.area;
      
      const inArea = (minX === undefined || actualPosition.x >= minX) &&
                     (maxX === undefined || actualPosition.x <= maxX) &&
                     (minY === undefined || actualPosition.y >= minY) &&
                     (maxY === undefined || actualPosition.y <= maxY) &&
                     (minZ === undefined || actualPosition.z >= minZ) &&
                     (maxZ === undefined || actualPosition.z <= maxZ);
      
      return {
        success: inArea,
        message: inArea 
          ? '位置在指定区域内' 
          : `位置不在指定区域内: (${actualPosition.x}, ${actualPosition.y}, ${actualPosition.z})`
      };
    }
    
    return { success: true, message: '位置验证通过(无精确要求)' };
  }
  
  /**
   * 验证移动距离
   * @param {number} actualDistance - 实际距离
   * @param {number|Object} expectedDistance - 预期距离或距离范围
   * @returns {Object} - 验证结果
   */
  verifyDistance(actualDistance, expectedDistance) {
    if (actualDistance === undefined) {
      return { success: false, message: '实际距离为空' };
    }
    
    // 如果预期距离是一个对象(有min/max)
    if (typeof expectedDistance === 'object') {
      const minOk = expectedDistance.min === undefined || 
                    actualDistance >= expectedDistance.min;
      const maxOk = expectedDistance.max === undefined || 
                    actualDistance <= expectedDistance.max;
      
      const success = minOk && maxOk;
      
      return {
        success,
        message: success 
          ? `距离在预期范围内: ${actualDistance}` 
          : `距离超出预期范围: ${actualDistance}, 预期: min=${expectedDistance.min}, max=${expectedDistance.max}`
      };
    }
    
    // 如果预期距离是一个数值
    if (typeof expectedDistance === 'number') {
      const tolerance = 1.0; // 默认容差
      const diff = Math.abs(actualDistance - expectedDistance);
      const success = diff <= tolerance;
      
      return {
        success,
        message: success 
          ? `距离在容差 ${tolerance} 内: ${actualDistance}` 
          : `距离超出容差: ${actualDistance}, 预期: ${expectedDistance}`
      };
    }
    
    return { success: true, message: '距离验证通过(无精确要求)' };
  }
  
  /**
   * 验证附近的对象
   * @param {Object} actualObjects - 实际对象列表
   * @param {Object} expectedObjects - 预期对象数量或特征
   * @returns {Object} - 验证结果
   */
  verifyNearbyObjects(actualObjects, expectedObjects) {
    if (!actualObjects) {
      return { success: false, message: '实际对象列表为空' };
    }
    
    const failures = [];
    
    // 检查树木数量
    if (expectedObjects.trees !== undefined) {
      const actualTreeCount = actualObjects.trees ? actualObjects.trees.length : 0;
      
      if (typeof expectedObjects.trees === 'object') {
        // 范围检查
        const minOk = expectedObjects.trees.min === undefined || 
                      actualTreeCount >= expectedObjects.trees.min;
        const maxOk = expectedObjects.trees.max === undefined || 
                      actualTreeCount <= expectedObjects.trees.max;
        
        if (!minOk) {
          failures.push(`树木数量 ${actualTreeCount} 小于最小值 ${expectedObjects.trees.min}`);
        }
        if (!maxOk) {
          failures.push(`树木数量 ${actualTreeCount} 大于最大值 ${expectedObjects.trees.max}`);
        }
      } else {
        // 精确匹配
        if (actualTreeCount !== expectedObjects.trees) {
          failures.push(`树木数量不匹配: 预期 ${expectedObjects.trees}, 实际 ${actualTreeCount}`);
        }
      }
    }
    
    // 检查岩石数量
    if (expectedObjects.rocks !== undefined) {
      const actualRockCount = actualObjects.rocks ? actualObjects.rocks.length : 0;
      
      if (typeof expectedObjects.rocks === 'object') {
        // 范围检查
        const minOk = expectedObjects.rocks.min === undefined || 
                      actualRockCount >= expectedObjects.rocks.min;
        const maxOk = expectedObjects.rocks.max === undefined || 
                      actualRockCount <= expectedObjects.rocks.max;
        
        if (!minOk) {
          failures.push(`岩石数量 ${actualRockCount} 小于最小值 ${expectedObjects.rocks.min}`);
        }
        if (!maxOk) {
          failures.push(`岩石数量 ${actualRockCount} 大于最大值 ${expectedObjects.rocks.max}`);
        }
      } else {
        // 精确匹配
        if (actualRockCount !== expectedObjects.rocks) {
          failures.push(`岩石数量不匹配: 预期 ${expectedObjects.rocks}, 实际 ${actualRockCount}`);
        }
      }
    }
    
    return {
      success: failures.length === 0,
      message: failures.length === 0 ? '附近对象验证通过' : failures.join('; ')
    };
  }
  
  /**
   * 评估条件是否满足
   * @param {Object} result - 命令执行结果
   * @param {Object} condition - 条件定义
   * @returns {boolean} - 条件是否满足
   */
  evaluateCondition(result, condition) {
    if (condition.type === 'position') {
      return this.verifyPosition(
        result.state.currentPosition || result.state.position,
        condition.value
      ).success;
    }
    
    if (condition.type === 'distance') {
      return this.verifyDistance(
        result.state.distanceMoved,
        condition.value
      ).success;
    }
    
    if (condition.type === 'state' && condition.property) {
      const propertyPath = condition.property.split('.');
      let value = result.state;
      
      // 遍历属性路径获取值
      for (const prop of propertyPath) {
        if (value === undefined || value === null) return false;
        value = value[prop];
      }
      
      // 根据操作符比较值
      switch (condition.operator) {
        case '==': return value == condition.value;
        case '===': return value === condition.value;
        case '!=': return value != condition.value;
        case '!==': return value !== condition.value;
        case '>': return value > condition.value;
        case '>=': return value >= condition.value;
        case '<': return value < condition.value;
        case '<=': return value <= condition.value;
        default: return false;
      }
    }
    
    return false;
  }
  
  /**
   * 计算任务分数
   * @param {Object} taskResult - 任务执行结果
   * @param {Object} task - 任务定义
   * @returns {number} - 计算得分
   */
  calculateScore(taskResult, task) {
    if (!taskResult.success) {
      return 0; // 如果任务失败，分数为0
    }
    
    if (task.scoreFunction) {
      try {
        // 如果定义了自定义评分函数，使用它
        return task.scoreFunction(taskResult);
      } catch (error) {
        console.error('评分函数执行出错:', error);
        return 0;
      }
    }
    
    // 默认评分方案
    const totalSteps = task.steps.length;
    const successfulSteps = taskResult.steps.filter(s => s.verification && s.verification.success).length;
    
    // 基础分数 - 成功步骤比例
    let score = Math.round((successfulSteps / totalSteps) * 100);
    
    // 时间奖励/惩罚 - 如果任务有时间限制
    if (task.timeLimit && taskResult.duration < task.timeLimit) {
      // 提前完成奖励
      const timeRatio = 1 - (taskResult.duration / task.timeLimit);
      score += Math.round(timeRatio * 10); // 最多10分的时间奖励
    }
    
    // 确保分数在0-100范围内
    return Math.min(100, Math.max(0, score));
  }
  
  /**
   * 获取所有任务
   * @returns {Array} - 任务列表
   */
  getTasks() {
    return this.tasks;
  }
  
  /**
   * 获取所有结果
   * @returns {Array} - 结果列表
   */
  getResults() {
    return this.results;
  }
  
  /**
   * 清除所有结果
   */
  clearResults() {
    this.results = [];
    return { success: true, message: '结果已清除' };
  }
} 