import * as THREE from 'three';

/**
 * LVLM接口类 - 用于视觉语言模型与Three.js环境交互
 */
export class LVLMInterface {
  constructor(world, player, renderer, scene, camera) {
    this.world = world;
    this.player = player;
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.history = [];
    this.tempCamera = camera.clone();
    
    console.log('LVLM接口已初始化');
  }
  
  /**
   * 执行LVLM指令并返回结果
   * @param {Object} command - 命令对象
   * @returns {Object} - 执行结果
   */
  async executeCommand(command) {
    const startTime = performance.now();
    let result = {
      success: false,
      message: '',
      observation: null,
      state: null
    };
    
    try {
      // 解析并执行命令
      switch (command.type) {
        case 'move':
          result = this.movePlayer(command.direction, command.distance || 1);
          break;
          
        case 'look':
          result = this.lookDirection(command.direction, command.angle);
          break;
          
        case 'jump':
          result = this.playerJump();
          break;
          
        case 'observe':
          result = this.observeEnvironment(command.detail || 'normal');
          break;
          
        case 'scan':
          result = this.scanEnvironment(command.radius || 10);
          break;
          
        case 'query':
          result = this.queryEnvironment(command.property);
          break;
          
        case 'teleport':
          if (command.position) {
            result = this.teleportPlayer(
              command.position.x, 
              command.position.y, 
              command.position.z
            );
          } else {
            result.message = '缺少位置参数';
          }
          break;
          
        default:
          result.message = `未知命令类型: ${command.type}`;
          break;
      }
      
      // 记录历史
      this.history.push({
        timestamp: Date.now(),
        command: command,
        result: { ...result, observation: '图像数据已省略' }  // 不存储图像数据以节省内存
      });
      
      result.success = true;
    } catch (error) {
      result.message = `执行出错: ${error.message}`;
      result.error = error.toString();
    }
    
    result.executionTime = performance.now() - startTime;
    return result;
  }
  
  /**
   * 移动玩家
   * @param {string} direction - 移动方向 (forward, backward, left, right)
   * @param {number} distance - 移动距离
   * @returns {Object} - 移动结果
   */
  movePlayer(direction, distance) {
    const originalPosition = new THREE.Vector3().copy(this.player.position);
    
    // 模拟按键press和release以移动玩家
    switch (direction) {
      case 'forward':
        this.player.keys.forward = true;
        setTimeout(() => { this.player.keys.forward = false; }, distance * 100);
        break;
      case 'backward':
        this.player.keys.backward = true;
        setTimeout(() => { this.player.keys.backward = false; }, distance * 100);
        break;
      case 'left':
        this.player.keys.left = true;
        setTimeout(() => { this.player.keys.left = false; }, distance * 100);
        break;
      case 'right':
        this.player.keys.right = true;
        setTimeout(() => { this.player.keys.right = false; }, distance * 100);
        break;
      default:
        return {
          message: `无效的移动方向: ${direction}`,
          observation: this.captureCurrentView(),
          state: { position: this.player.position.clone() }
        };
    }
    
    // 等待移动完成
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({
          message: `向${direction}移动了${distance}个单位`,
          observation: this.captureCurrentView(),
          state: {
            previousPosition: originalPosition,
            currentPosition: this.player.position.clone(),
            distanceMoved: originalPosition.distanceTo(this.player.position)
          }
        });
      }, distance * 100 + 50);
    });
  }
  
  /**
   * 控制玩家视角
   * @param {string} direction - 视角方向 (up, down, left, right)
   * @param {number} angle - 旋转角度(弧度)
   * @returns {Object} - 执行结果
   */
  lookDirection(direction, angle = Math.PI / 8) {
    const originalRotationX = this.player.pitchObject.rotation.x;
    const originalRotationY = this.player.yawObject.rotation.y;
    
    switch (direction) {
      case 'up':
        this.player.pitchObject.rotation.x = Math.max(
          -Math.PI / 2, 
          this.player.pitchObject.rotation.x - angle
        );
        break;
      case 'down':
        this.player.pitchObject.rotation.x = Math.min(
          Math.PI / 2, 
          this.player.pitchObject.rotation.x + angle
        );
        break;
      case 'left':
        this.player.yawObject.rotation.y += angle;
        break;
      case 'right':
        this.player.yawObject.rotation.y -= angle;
        break;
      case 'around':
        this.player.yawObject.rotation.y += Math.PI;
        break;
      default:
        return {
          message: `无效的视角方向: ${direction}`,
          observation: this.captureCurrentView(),
          state: { 
            rotationX: this.player.pitchObject.rotation.x,
            rotationY: this.player.yawObject.rotation.y
          }
        };
    }
    
    return {
      message: `向${direction}转动视角`,
      observation: this.captureCurrentView(),
      state: {
        previousRotationX: originalRotationX,
        previousRotationY: originalRotationY,
        currentRotationX: this.player.pitchObject.rotation.x,
        currentRotationY: this.player.yawObject.rotation.y
      }
    };
  }
  
  /**
   * 玩家跳跃
   * @returns {Object} - 跳跃结果
   */
  playerJump() {
    const originalPosition = new THREE.Vector3().copy(this.player.position);
    
    if (this.player.isJumping) {
      return {
        message: '玩家已在空中，无法跳跃',
        observation: this.captureCurrentView(),
        state: { position: this.player.position.clone(), isJumping: true }
      };
    }
    
    this.player.keys.jump = true;
    setTimeout(() => { this.player.keys.jump = false; }, 100);
    
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({
          message: '玩家跳跃',
          observation: this.captureCurrentView(),
          state: {
            previousPosition: originalPosition,
            currentPosition: this.player.position.clone(),
            isJumping: this.player.isJumping
          }
        });
      }, 500);
    });
  }
  
  /**
   * 观察环境
   * @param {string} detail - 观察细节程度 (low, normal, high)
   * @returns {Object} - 观察结果
   */
  observeEnvironment(detail = 'normal') {
    let fieldOfView = 75; // 默认FOV
    
    // 根据细节程度调整FOV
    switch (detail) {
      case 'low':
        fieldOfView = 100; // 广角
        break;
      case 'high':
        fieldOfView = 45; // 望远
        break;
    }
    
    const originalFOV = this.camera.fov;
    this.camera.fov = fieldOfView;
    this.camera.updateProjectionMatrix();
    
    const result = {
      message: `以${detail}细节程度观察环境`,
      observation: this.captureCurrentView(),
      state: {
        position: this.player.position.clone(),
        rotation: {
          x: this.player.pitchObject.rotation.x,
          y: this.player.yawObject.rotation.y
        },
        fov: fieldOfView,
        visibleObjects: this.getVisibleObjects()
      }
    };
    
    // 恢复原始FOV
    this.camera.fov = originalFOV;
    this.camera.updateProjectionMatrix();
    
    return result;
  }
  
  /**
   * 扫描环境中的物体
   * @param {number} radius - 扫描半径
   * @returns {Object} - 扫描结果
   */
  scanEnvironment(radius = 10) {
    const playerPosition = this.player.position.clone();
    const nearbyTrees = this.world.trees.filter(tree => 
      tree.position.distanceTo(playerPosition) <= radius
    );
    
    const nearbyRocks = this.world.rocks.filter(rock => 
      rock.position.distanceTo(playerPosition) <= radius
    );
    
    // 多角度观察
    const observations = [];
    const originalRotationY = this.player.yawObject.rotation.y;
    
    // 从四个方向观察
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 2) {
      this.player.yawObject.rotation.y = angle;
      observations.push(this.captureCurrentView());
    }
    
    // 恢复原始旋转
    this.player.yawObject.rotation.y = originalRotationY;
    
    return {
      message: `扫描半径${radius}单位内的环境`,
      observation: observations,
      state: {
        position: playerPosition,
        nearbyObjects: {
          trees: nearbyTrees.map(tree => ({
            distance: tree.position.distanceTo(playerPosition),
            position: tree.position
          })),
          rocks: nearbyRocks.map(rock => ({
            distance: rock.position.distanceTo(playerPosition),
            position: rock.position,
            scale: rock.mesh.scale.x
          }))
        },
        terrainHeight: this.world.getHeightAt(playerPosition.x, playerPosition.z)
      }
    };
  }
  
  /**
   * 查询环境特定属性
   * @param {string} property - 查询的属性
   * @returns {Object} - 查询结果
   */
  queryEnvironment(property) {
    let data = null;
    let message = '';
    
    switch (property) {
      case 'playerPosition':
        data = this.player.position.clone();
        message = '获取玩家位置';
        break;
      case 'terrainInfo':
        data = {
          size: this.world.terrainSize,
          playerHeight: this.world.getHeightAt(
            this.player.position.x, 
            this.player.position.z
          )
        };
        message = '获取地形信息';
        break;
      case 'objectCounts':
        data = {
          trees: this.world.trees.length,
          rocks: this.world.rocks.length
        };
        message = '获取对象数量信息';
        break;
      case 'fullState':
        data = this.getFullEnvironmentState();
        message = '获取完整环境状态';
        break;
      default:
        message = `未知属性: ${property}`;
        break;
    }
    
    return {
      message,
      observation: this.captureCurrentView(),
      state: data
    };
  }
  
  /**
   * 传送玩家到特定位置
   * @param {number} x - X坐标
   * @param {number} y - Y坐标 (可选，默认为地形高度)
   * @param {number} z - Z坐标
   * @returns {Object} - 传送结果
   */
  teleportPlayer(x, z, y = null) {
    const originalPosition = new THREE.Vector3().copy(this.player.position);
    
    // 如果y未指定，使用地形高度
    if (y === null) {
      y = this.world.getHeightAt(x, z) + this.player.height;
    }
    
    // 设置新位置
    this.player.position.set(x, y, z);
    this.player.yawObject.position.copy(this.player.position);
    
    return {
      message: `传送到位置 (${x}, ${y}, ${z})`,
      observation: this.captureCurrentView(),
      state: {
        previousPosition: originalPosition,
        currentPosition: this.player.position.clone()
      }
    };
  }
  
  /**
   * 捕获当前视图
   * @returns {string} - base64编码的图像数据URL
   */
  captureCurrentView() {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }
  
  /**
   * 获取可见的对象
   * @returns {Array} - 可见对象列表
   */
  getVisibleObjects() {
    const frustum = new THREE.Frustum();
    const matrix = new THREE.Matrix4().multiplyMatrices(
      this.camera.projectionMatrix,
      this.camera.matrixWorldInverse
    );
    frustum.setFromProjectionMatrix(matrix);
    
    const visibleTrees = this.world.trees.filter(tree => 
      frustum.intersectsObject(tree.trunk) || frustum.intersectsObject(tree.leaves)
    );
    
    const visibleRocks = this.world.rocks.filter(rock => 
      frustum.intersectsObject(rock.mesh)
    );
    
    return {
      trees: visibleTrees.length,
      rocks: visibleRocks.length
    };
  }
  
  /**
   * 获取完整环境状态
   * @returns {Object} - 环境状态
   */
  getFullEnvironmentState() {
    return {
      player: {
        position: this.player.position.clone(),
        rotation: {
          pitch: this.player.pitchObject.rotation.x,
          yaw: this.player.yawObject.rotation.y
        },
        isJumping: this.player.isJumping,
        height: this.player.height
      },
      terrain: {
        size: this.world.terrainSize,
        heightAtPlayer: this.world.getHeightAt(
          this.player.position.x, 
          this.player.position.z
        )
      },
      objects: {
        treeCount: this.world.trees.length,
        rockCount: this.world.rocks.length,
        nearbyTrees: this.world.trees
          .filter(tree => tree.position.distanceTo(this.player.position) < 20)
          .map(tree => ({
            distance: tree.position.distanceTo(this.player.position),
            position: tree.position
          })),
        nearbyRocks: this.world.rocks
          .filter(rock => rock.position.distanceTo(this.player.position) < 20)
          .map(rock => ({
            distance: rock.position.distanceTo(this.player.position),
            position: rock.position
          }))
      }
    };
  }
  
  /**
   * 清除历史记录
   */
  clearHistory() {
    this.history = [];
    return { success: true, message: '历史记录已清除' };
  }
  
  /**
   * 获取历史记录
   * @returns {Array} - 历史命令和结果
   */
  getHistory() {
    return this.history;
  }
} 