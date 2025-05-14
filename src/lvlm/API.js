/**
 * API接口 - 提供REST API与LVLM模型通信
 */

import { LVLMInterface } from './LVLMInterface.js';
import { VerificationFramework } from './VerificationFramework.js';
import { createSampleTasks } from './sampleTasks.js';

/**
 * 设置API服务
 * @param {Object} world - 游戏世界实例
 * @param {Object} player - 玩家实例
 * @param {Object} renderer - Three.js渲染器
 * @param {Object} scene - Three.js场景
 * @param {Object} camera - Three.js相机
 */
export function setupAPI(world, player, renderer, scene, camera) {
  // 创建LVLM接口和验证框架
  const lvlmInterface = new LVLMInterface(world, player, renderer, scene, camera);
  const verificationFramework = new VerificationFramework(lvlmInterface);
  
  // 添加样例任务
  const sampleTasks = createSampleTasks();
  sampleTasks.forEach(task => verificationFramework.addTask(task));
  
  console.log(`已初始化LVLM API，并加载了${sampleTasks.length}个示例任务`);
  
  // 设置游戏内API访问点 - 允许从控制台访问
  window.lvlmAPI = {
    interface: lvlmInterface,
    verification: verificationFramework,
    
    /**
     * 执行命令
     * @param {Object} command - 命令对象
     * @returns {Promise<Object>} - 命令执行结果
     */
    executeCommand: async (command) => {
      console.log('执行命令:', command);
      return await lvlmInterface.executeCommand(command);
    },
    
    /**
     * 运行验证任务
     * @param {string} taskId - 任务ID (可选，如果不提供则运行所有任务)
     * @returns {Promise<Object>} - 验证结果
     */
    runVerification: async (taskId) => {
      if (taskId) {
        console.log(`运行任务验证: ${taskId}`);
        return await verificationFramework.runTaskVerification(taskId);
      } else {
        console.log('运行所有任务验证');
        return await verificationFramework.runAllVerifications();
      }
    },
    
    /**
     * 添加自定义任务
     * @param {Object} task - 任务定义
     * @returns {string} - 任务ID
     */
    addTask: (task) => {
      return verificationFramework.addTask(task);
    },
    
    /**
     * 获取所有任务
     * @returns {Array} - 任务列表
     */
    getTasks: () => {
      return verificationFramework.getTasks();
    },
    
    /**
     * 获取所有结果
     * @returns {Array} - 结果列表
     */
    getResults: () => {
      return verificationFramework.getResults();
    },
    
    /**
     * 清除结果
     */
    clearResults: () => {
      return verificationFramework.clearResults();
    },
    
    /**
     * 清除历史记录
     */
    clearHistory: () => {
      return lvlmInterface.clearHistory();
    },
    
    /**
     * 获取命令历史记录
     * @returns {Array} - 历史命令和结果
     */
    getHistory: () => {
      return lvlmInterface.getHistory();
    }
  };
  
  // 如果支持全屏API，添加全屏切换功能
  if (document.documentElement.requestFullscreen) {
    window.lvlmAPI.toggleFullscreen = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
        return { success: true, message: '进入全屏模式' };
      } else {
        document.exitFullscreen();
        return { success: true, message: '退出全屏模式' };
      }
    };
  }
  
  console.log('LVLM API已设置完成，可通过window.lvlmAPI访问');
  
  // 如果需要在页面上添加API控制面板，可以在此处实现
  addAPIControl();
}

/**
 * 添加API控制面板到页面
 */
function addAPIControl() {
  // 创建控制面板元素
  const controlPanel = document.createElement('div');
  controlPanel.id = 'lvlm-control-panel';
  controlPanel.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background-color: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 10px;
    border-radius: 5px;
    font-family: monospace;
    font-size: 12px;
    z-index: 1000;
    display: none;
  `;
  
  // 添加面板内容
  controlPanel.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 5px;">LVLM API控制面板</div>
    <div id="lvlm-status">状态: 就绪</div>
    <div style="margin-top: 5px;">
      <button id="lvlm-toggle-panel">隐藏面板</button>
      <button id="lvlm-run-task">运行任务</button>
      <select id="lvlm-task-select">
        <option value="">-- 选择任务 --</option>
      </select>
    </div>
    <div id="lvlm-result" style="margin-top: 5px; max-height: 100px; overflow-y: auto;"></div>
  `;
  
  // 添加到文档
  document.body.appendChild(controlPanel);
  
  // 添加键盘快捷键切换面板
  document.addEventListener('keydown', (event) => {
    if (event.code === 'KeyL' && event.ctrlKey) {
      toggleControlPanel();
    }
  });
  
  // 添加按钮事件监听
  document.getElementById('lvlm-toggle-panel').addEventListener('click', toggleControlPanel);
  
  document.getElementById('lvlm-run-task').addEventListener('click', async () => {
    const taskSelect = document.getElementById('lvlm-task-select');
    const taskId = taskSelect.value;
    
    if (!taskId) {
      updateStatus('请选择任务');
      return;
    }
    
    updateStatus(`正在运行任务: ${taskId}`);
    
    try {
      const result = await window.lvlmAPI.runVerification(taskId);
      updateResult(JSON.stringify(result, null, 2));
      updateStatus(`任务运行完成: ${result.success ? '成功' : '失败'}`);
    } catch (error) {
      updateResult(`错误: ${error.message}`);
      updateStatus('任务运行失败');
    }
  });
  
  // 更新任务选择器
  function updateTaskSelect() {
    if (!window.lvlmAPI) return;
    
    const tasks = window.lvlmAPI.getTasks();
    const taskSelect = document.getElementById('lvlm-task-select');
    
    taskSelect.innerHTML = '<option value="">-- 选择任务 --</option>';
    
    tasks.forEach(task => {
      const option = document.createElement('option');
      option.value = task.id;
      option.textContent = `${task.id} - ${task.name}`;
      taskSelect.appendChild(option);
    });
  }
  
  // 更新状态显示
  function updateStatus(status) {
    const statusElement = document.getElementById('lvlm-status');
    if (statusElement) {
      statusElement.textContent = `状态: ${status}`;
    }
  }
  
  // 更新结果显示
  function updateResult(result) {
    const resultElement = document.getElementById('lvlm-result');
    if (resultElement) {
      resultElement.innerHTML = `<pre>${result}</pre>`;
    }
  }
  
  // 切换控制面板显示
  function toggleControlPanel() {
    const panel = document.getElementById('lvlm-control-panel');
    if (panel) {
      if (panel.style.display === 'none') {
        panel.style.display = 'block';
        updateTaskSelect(); // 显示面板时更新任务列表
      } else {
        panel.style.display = 'none';
      }
    }
  }
} 