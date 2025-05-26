import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class Player {
    constructor(camera, ground, scene) {
        // 玩家参数
        this.camera = camera;
        this.ground = ground;
        this.moveSpeed = 10;
        this.jumpForce = 10;
        this.gravity = 20;
        
        // 相机朝向控制（专用于第三人称视图）
        this.cameraOrientation = 0; // 相机水平旋转角度
        
        // 玩家状态
        this.position = new THREE.Vector3(0, 0, 0);  // 位置
        this.velocity = new THREE.Vector3(0, 0, 0); // 速度
        this.direction = new THREE.Vector3(0, 0, 0); // 方向
        this.isJumping = false; // 是否跳跃
        this.height = 1.8; // 玩家高度
        this.standingHeight = 1.8; // 站立时的高度
        this.crouchHeight = 0.9; // 下蹲时的高度
        this.isCrouching = false; // 是否下蹲
        this.standingSpeed = 10; // 站立时的速度
        this.crouchSpeed = 5; // 下蹲时的速度
        this.crouchJumpForce = 7; // 下蹲时的跳跃力
        
        // 相机视角位置参数
        this.eyeOffset = 1.7; // 相机在玩家头部的位置偏移（眼睛高度）
        this.crouchEyeOffset = 0.8; // 下蹲时的眼睛高度
        this.crouchAnimationSpeed = 8; // 下蹲/站立动画速度
        
        // 碰撞参数
        this.radius = 0.5; // 玩家碰撞半径
        this.collidableObjects = []; // 可碰撞对象列表
        
        // 输入控制
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            jump: false,
            crouch: false
        };
        
        // 鼠标控制
        this.mouseSensitivity = 0.002;
        this.pitchObject = new THREE.Object3D(); // 俯仰（上下看）
        this.yawObject = new THREE.Object3D(); // 偏航（左右看）
        
        this.pitchObject.position.y = this.eyeOffset; // 初始化相机高度为眼睛高度
        this.pitchObject.add(camera);
        this.yawObject.add(this.pitchObject);
        
        // 角色模型相关
        this.model = null;
        this.mixer = null;
        this.actions = {};
        this.activeAction = null;
        this.previousAction = null;
        this.currentBaseAction = 'Idle'; // 默认动画状态
        this.playingSpecialAnimation = false; // 是否正在播放特殊动画
        this.animationStates = {
            Idle: 'Idle',
            Walking: 'Walking',
            Running: 'Running',
            Dance: 'Dance',
            Jump: 'Jump',
            Death: 'Death',
            Sitting: 'Sitting',
            Standing: 'Standing',
            Yes: 'Yes',
            No: 'No',
            Wave: 'Wave',
            Punch: 'Punch',
            ThumbsUp: 'ThumbsUp'
        };
        
        // 添加场景引用
        this.scene = scene;
        
        // 添加旋转相关参数
        this.currentRotation = 0;  // 当前旋转角度
        this.targetRotation = 0;   // 目标旋转角度
        this.rotationSpeed = 10;   // 旋转速度系数
        
        // 初始化
        this.init();
    }
    
    init() {
        // 添加键盘事件监听
        document.addEventListener('keydown', this.onKeyDown.bind(this), false);
        document.addEventListener('keyup', this.onKeyUp.bind(this), false);
        
        // 载入角色模型
        this.loadCharacterModel();
        
        // 更新初始位置到地面上
        this.updatePositionToGround();
    }
    
    // 加载角色模型
    loadCharacterModel() {
        const modelURL = 'https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb';
        const loader = new GLTFLoader();
        
        loader.load(modelURL, (gltf) => {
            this.model = gltf.scene;
            this.model.scale.set(0.5, 0.5, 0.5);
            this.model.position.copy(this.position);
            this.model.position.y = this.position.y - this.height + 0.5;
            this.model.visible = false; // 在第一人称模式下默认隐藏模型
            
            // 处理阴影
            this.model.traverse(function (object) {
                if (object.isMesh) {
                    object.castShadow = true;
                    object.receiveShadow = true;
                }
            });
            
            // 将模型添加到场景中，而不是yawObject
            this.scene.add(this.model);
            
            // 设置动画混合器
            this.mixer = new THREE.AnimationMixer(this.model);
            
            // 设置动画动作
            this.actions = {};
            gltf.animations.forEach((clip) => {
                const action = this.mixer.clipAction(clip);
                this.actions[clip.name] = action;
                
                // 设置一次性动画
                if (['Jump', 'Yes', 'No', 'Wave', 'Punch', 'ThumbsUp', 'Death', 'Sitting', 'Standing'].includes(clip.name)) {
                    action.loop = THREE.LoopOnce;
                    action.clampWhenFinished = true;
                }
            });
            
            // 设置初始动画
            if (this.actions['Idle']) {
                this.activeAction = this.actions['Idle'];
                this.activeAction.play();
            }
            
            console.log('角色模型已加载');
        }, undefined, (error) => {
            console.error('加载模型时发生错误:', error);
        });
    }
    
    // 切换动画
    fadeToAction(name, duration = 0.2, isOneShot = false) {
        if (!this.actions[name]) {
            console.warn(`未找到动画 "${name}"！`);
            return;
        }
        
        this.previousAction = this.activeAction;
        this.activeAction = this.actions[name];
        
        if (this.previousAction !== this.activeAction) {
            if (this.previousAction) {
                this.previousAction.fadeOut(duration);
            }
            
            this.activeAction
                .reset()
                .setEffectiveTimeScale(1)
                .setEffectiveWeight(1)
                .fadeIn(duration)
                .play();
                
            // 如果是一次性动画，播放完后切回基础状态
            if (isOneShot && this.mixer) {
                // 移除所有已存在的监听器，避免重复
                const existingListeners = this.mixer._listeners?.finished?.slice() || [];
                existingListeners.forEach(listener => {
                    this.mixer.removeEventListener('finished', listener);
                });
                
                // 添加新的监听器
                const onFinished = (e) => {
                    if (e.action === this.activeAction) {
                        this.mixer.removeEventListener('finished', onFinished);
                        this.playingSpecialAnimation = false; // 重置特殊动画标志
                        this.fadeToAction(this.currentBaseAction, 0.2);
                    }
                };
                
                this.mixer.addEventListener('finished', onFinished);
            }
        }
    }
    
    // 更新动画状态
    updateAnimation(delta) {
        if (this.mixer) {
            this.mixer.update(delta);
            
            // 如果正在播放特殊动画，不进行状态更新
            if (this.playingSpecialAnimation) {
                return;
            }
            
            // 根据玩家状态更新动画
            if (this.isJumping && this.activeAction !== this.actions['Jump']) {
                this.fadeToAction('Jump', 0.2, true);
            } 
            else if (!this.isJumping) {
                // 根据移动状态切换动画
                let newAction = this.currentBaseAction;
                
                if (this.keys.forward || this.keys.backward || this.keys.left || this.keys.right) {
                    if (this.isCrouching) {
                        newAction = 'Walking'; // 下蹲行走使用普通行走动画
                    } else {
                        newAction = 'Running'; // 正常行走使用奔跑动画
                    }
                } else {
                    if (this.isCrouching) {
                        newAction = 'Sitting'; // 下蹲静止使用坐下动画
                    } else {
                        newAction = 'Idle'; // 站立静止使用待机动画
                    }
                }
                
                // 仅当动画需要改变时才切换
                if (this.activeAction !== this.actions[newAction] && !this.isJumping) {
                    this.currentBaseAction = newAction;
                    this.fadeToAction(newAction, 0.2);
                }
            }
        }
    }
    
    onKeyDown(event) {
        console.log('键盘按下:', event.code);
        switch (event.code) {
            case 'KeyW':
            case 'ArrowUp':
                this.keys.forward = true;
                break;
            case 'KeyS':
            case 'ArrowDown':
                this.keys.backward = true;
                break;
            case 'KeyA':
            case 'ArrowLeft':
                this.keys.left = true;
                break;
            case 'KeyD':
            case 'ArrowRight':
                this.keys.right = true;
                break;
            case 'Space':
                if (!this.isJumping) {
                    this.keys.jump = true;
                }
                break;
            case 'ShiftLeft':
            case 'ShiftRight':
                this.keys.crouch = true;
                break;
            // 添加触发特殊动画的按键
            case 'KeyY':
                if (this.actions && this.actions['Yes']) {
                    this.fadeToAction('Yes', 0.2, true);
                    this.playingSpecialAnimation = true;
                }
                break;
            case 'KeyN':
                if (this.actions && this.actions['No']) {
                    this.fadeToAction('No', 0.2, true);
                    this.playingSpecialAnimation = true;
                }
                break;
            case 'KeyV':
                if (this.actions && this.actions['Wave']) {
                    this.fadeToAction('Wave', 0.2, true);
                    this.playingSpecialAnimation = true;
                }
                break;
            case 'KeyP':
                if (this.actions && this.actions['Punch']) {
                    this.fadeToAction('Punch', 0.2, true);
                    this.playingSpecialAnimation = true;
                }
                break;
            case 'KeyX':
                if (this.actions && this.actions['Death']) {
                    this.fadeToAction('Death', 0.2, true);
                    this.playingSpecialAnimation = true;
                }
                break;
        }
    }
    
    onKeyUp(event) {
        switch (event.code) {
            case 'KeyW':
            case 'ArrowUp':
                this.keys.forward = false;
                break;
            case 'KeyS':
            case 'ArrowDown':
                this.keys.backward = false;
                break;
            case 'KeyA':
            case 'ArrowLeft':
                this.keys.left = false;
                break;
            case 'KeyD':
            case 'ArrowRight':
                this.keys.right = false;
                break;
            case 'Space':
                this.keys.jump = false;
                break;
            case 'ShiftLeft':
            case 'ShiftRight':
                this.keys.crouch = false;
                break;
        }
    }
    
    // 注册可碰撞对象
    registerCollidableObjects(objects) {
        this.collidableObjects = objects;
    }
    
    // 检测与物体的碰撞
    checkObjectCollisions() {
        // 创建一个表示玩家位置的向量（不含y轴高度）
        const playerPosition = new THREE.Vector2(this.position.x, this.position.z);
        
        // 检查所有可碰撞对象
        for (const object of this.collidableObjects) {
            if (!object.position) continue;
            
            // 创建物体位置向量（不含y轴高度）
            const objectPosition = new THREE.Vector2(object.position.x, object.position.z);
            
            // 计算距离
            const distance = playerPosition.distanceTo(objectPosition);
            
            // 根据物体类型获取碰撞半径和高度
            let collisionRadius = 0;
            let objectTopHeight = 0;
            
            if (object.type === 'tree') {
                collisionRadius = 1.0; // 树木碰撞半径
                objectTopHeight = object.height + object.trunkHeight; // 树干顶部高度
            } else if (object.type === 'rock') {
                collisionRadius = object.scale || 1.0; // 岩石碰撞半径
                objectTopHeight = object.height + object.scale; // 岩石顶部高度
            }
            
            // 检查碰撞
            const minDistance = this.radius + collisionRadius;
            if (distance < minDistance) {
                // 计算玩家底部高度
                const playerBottomHeight = this.position.y - this.height;
                
                // 只有当玩家在物体侧面区域时才应用侧面碰撞推力
                // 如果玩家已经在物体上方或即将落在物体上方，不应用侧面碰撞
                if (playerBottomHeight < objectTopHeight - 0.3) {
                    // 发生侧面碰撞，计算推力方向
                    const pushDirection = new THREE.Vector2()
                        .subVectors(playerPosition, objectPosition)
                        .normalize()
                        .multiplyScalar(minDistance - distance);
                    
                    // 应用推力
                    this.position.x += pushDirection.x;
                    this.position.z += pushDirection.y;
                    
                    return true; // 发生了碰撞
                }
            }
        }
        
        return false; // 没有碰撞
    }
    
    // 检查玩家是否站在物体上面
    checkStandingOnObject() {
        // 只有当玩家下落或站立时才检查
        if (this.velocity.y > 0) return null;
        
        const playerPosition = new THREE.Vector2(this.position.x, this.position.z);
        
        // 检查玩家下方是否有物体
        for (const object of this.collidableObjects) {
            if (!object.position) continue;
            
            const objectPosition = new THREE.Vector2(object.position.x, object.position.z);
            const distance = playerPosition.distanceTo(objectPosition);
            
            let collisionRadius = 0;
            let objectTopHeight = 0;
            
            if (object.type === 'tree') {
                collisionRadius = 1.0;
                objectTopHeight = object.height + object.trunkHeight; // 使用树干顶部高度
            } else if (object.type === 'rock') {
                collisionRadius = object.scale || 1.0;
                objectTopHeight = object.height + object.scale; // 使用岩石顶部高度
            }
            
            // 检查玩家是否在物体上方
            if (distance < this.radius + collisionRadius) {
                // 检查高度是否合适（玩家位置应该在物体顶部附近）
                const playerBottomHeight = this.position.y - this.height;
                if (Math.abs(playerBottomHeight - objectTopHeight) < 0.5) {
                    console.log(`玩家站在${object.type}上面，高度:${objectTopHeight}`);
                    return objectTopHeight;
                }
            }
        }
        
        return null;
    }
    
    // 添加平滑旋转辅助函数
    lerpAngle(start, end, t) {
        // 确保角度差在 -PI 到 PI 之间
        let diff = end - start;
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        
        return start + diff * t;
    }
    
    update(delta, viewMode = 'first-person') {
        if (!this.ground) return;
        
        // 输出玩家状态，用于调试
        if (this.keys.forward || this.keys.backward || this.keys.left || this.keys.right) {
            console.log('移动状态:', this.keys);
        }
        
        // 处理下蹲状态
        this.handleCrouching(delta);
        
        // 计算移动方向
        this.direction.set(0, 0, 0);
        
        if (this.keys.forward) {
            this.direction.z = -1;
        }
        if (this.keys.backward) {
            this.direction.z = 1;
        }
        if (this.keys.left) {
            this.direction.x = -1;
        }
        if (this.keys.right) {
            this.direction.x = 1;
        }
        
        // 归一化方向向量
        if (this.direction.length() > 0) {
            this.direction.normalize();
        }
        
        // 根据视图模式调整移动方向
        let moveDirection = new THREE.Vector3(0, 0, 0);
        
        if (viewMode === 'first-person') {
            // 第一人称模式：使用yawObject的旋转
            const rotationMatrix = new THREE.Matrix4();
            rotationMatrix.makeRotationY(this.yawObject.rotation.y);
            this.direction.applyMatrix4(rotationMatrix);
        } else {
            // 第三人称模式：使用相机的朝向来确定移动方向
            
            // 获取相机前方向量（相机看向的方向）
            const cameraDirection = new THREE.Vector3(0, 0, -1);
            const cameraQuaternion = this.camera.getWorldQuaternion(new THREE.Quaternion());
            cameraDirection.applyQuaternion(cameraQuaternion);
            cameraDirection.y = 0; // 保持水平
            cameraDirection.normalize();
            
            // 获取相机右方向量
            const cameraRight = new THREE.Vector3(1, 0, 0);
            cameraRight.applyQuaternion(cameraQuaternion);
            cameraRight.y = 0; // 保持水平
            cameraRight.normalize();
            
            // 根据按键输入计算最终方向
            moveDirection = new THREE.Vector3(0, 0, 0);
            if (this.keys.forward) moveDirection.add(cameraDirection);
            if (this.keys.backward) moveDirection.sub(cameraDirection);
            if (this.keys.left) moveDirection.sub(cameraRight);
            if (this.keys.right) moveDirection.add(cameraRight);
            
            if (moveDirection.length() > 0) {
                moveDirection.normalize();
                this.direction.copy(moveDirection);
            }
        }
        
        // 应用重力和跳跃
        this.velocity.y -= this.gravity * delta;
        
        // 支持蹲着跳跃，但跳跃力度较小
        if (this.keys.jump && !this.isJumping) {
            const jumpForce = this.isCrouching ? this.crouchJumpForce : this.jumpForce;
            this.velocity.y = jumpForce;
            this.isJumping = true;
        }
        
        // 保存当前位置用于碰撞恢复
        const previousPosition = this.position.clone();
        
        // 根据姿态调整移动速度
        const currentSpeed = this.isCrouching ? this.crouchSpeed : this.moveSpeed;
        
        // 应用速度到位置
        this.position.x += this.direction.x * currentSpeed * delta;
        this.position.z += this.direction.z * currentSpeed * delta;
        this.position.y += this.velocity.y * delta;
        
        // 检测与地面的碰撞
        const groundHeight = this.getGroundHeight(this.position.x, this.position.z);
        
        // 检查是否站在物体上
        const objectHeight = this.checkStandingOnObject();
        
        // 如果站在物体上
        if (objectHeight !== null && this.position.y <= objectHeight + this.height) {
            this.position.y = objectHeight + this.height;
            this.velocity.y = 0;
            this.isJumping = false;
        }
        // 如果在地面以下，将位置调整到地面上
        else if (this.position.y <= groundHeight + this.height) {
            this.position.y = groundHeight + this.height;
            this.velocity.y = 0;
            this.isJumping = false;
        }
        
        // 检测与物体的碰撞
        if (this.checkObjectCollisions()) {
            // 如果发生严重碰撞，回退到上一个位置
            if (this.checkObjectCollisions()) {
                this.position.copy(previousPosition);
            }
        }
        
        // 更新yaw对象位置
        this.yawObject.position.copy(this.position);
        
        // 更新相机高度，仅在第一人称视图下才执行
        if (viewMode === 'first-person') {
            this.updateCameraHeight(delta);
        }
        
        // 在第三人称模式下更新模型位置和旋转
        if (viewMode === 'third-person' && this.model) {
            // 更新模型位置
            this.model.position.copy(this.position);
            // 将模型位置向下调整，使其脚部正好在地面上
            this.model.position.y = this.position.y - this.height;

            // 只在移动时更新目标旋转角度
            if (moveDirection.length() > 0) {
                this.targetRotation = Math.atan2(moveDirection.x, moveDirection.z);
            }

            // 平滑插值到目标旋转角度
            this.currentRotation = this.lerpAngle(
                this.currentRotation,
                this.targetRotation,
                delta * this.rotationSpeed
            );

            // 应用旋转
            this.model.rotation.y = this.currentRotation;
            
            // 同步yawObject旋转与模型旋转
            // 这样切换回第一人称时，视角方向将与角色朝向一致
            this.yawObject.rotation.y = this.currentRotation;
        }
        
        // 更新动画
        this.updateAnimation(delta);
    }
    
    // 处理下蹲状态
    handleCrouching(delta) {
        // 处理下蹲状态变化
        if (this.keys.crouch && !this.isCrouching) {
            // 从站立到下蹲
            this.isCrouching = true;
            this.height = this.crouchHeight;
            console.log('下蹲');
        } else if (!this.keys.crouch && this.isCrouching) {
            // 从下蹲到站立
            // 检查头顶是否有空间站起来（仅在地面上才需要检查）
            const canStandUp = this.isJumping ? true : this.checkHeadroom();
            if (canStandUp) {
                this.isCrouching = false;
                this.height = this.standingHeight;
                console.log('站立');
            } else {
                console.log('头顶空间不足，无法站立');
            }
        }
    }
    
    // 更新相机高度，实现平滑过渡
    updateCameraHeight(delta) {
        // 当前和目标眼睛高度
        const currentEyeHeight = this.pitchObject.position.y;
        const targetEyeHeight = this.isCrouching ? this.crouchEyeOffset : this.eyeOffset;
        
        // 如果当前高度与目标高度不同，则平滑过渡
        if (Math.abs(currentEyeHeight - targetEyeHeight) > 0.01) {
            // 平滑过渡到目标高度
            const diff = targetEyeHeight - currentEyeHeight;
            this.pitchObject.position.y += diff * this.crouchAnimationSpeed * delta;
        } else {
            // 已接近目标高度，直接设置为目标高度
            this.pitchObject.position.y = targetEyeHeight;
        }
    }
    
    // 检查头顶是否有足够空间站起来
    checkHeadroom() {
        // 检查头顶是否有障碍物
        for (const object of this.collidableObjects) {
            if (!object.position) continue;
            
            const playerPosition = new THREE.Vector2(this.position.x, this.position.z);
            const objectPosition = new THREE.Vector2(object.position.x, object.position.z);
            const distance = playerPosition.distanceTo(objectPosition);
            
            let collisionRadius = 0;
            let objectBottomHeight = 0;
            
            if (object.type === 'tree') {
                collisionRadius = 1.0;
                objectBottomHeight = object.height; // 树的底部高度
            } else if (object.type === 'rock') {
                collisionRadius = object.scale || 1.0;
                objectBottomHeight = object.height; // 岩石的底部高度
            }
            
            // 如果玩家在物体下方
            if (distance < this.radius + collisionRadius) {
                // 检查物体底部是否在玩家当前位置和站立高度之间
                const playerCurrentTop = this.position.y;
                const playerStandingTop = playerCurrentTop + (this.standingHeight - this.crouchHeight);
                
                if (objectBottomHeight < playerStandingTop && objectBottomHeight > playerCurrentTop) {
                    return false; // 空间不足，无法站立
                }
            }
        }
        
        return true; // 可以站立
    }
    
    // 获取地面高度
    getGroundHeight(x, z) {
        // 转换到世界类中的getHeightAt函数
        const geometry = this.ground.geometry;
        const positionAttribute = geometry.attributes.position;
        
        // 获取地形尺寸和分辨率
        const width = this.ground.geometry.parameters.width;
        const height = this.ground.geometry.parameters.height;
        const widthSegments = this.ground.geometry.parameters.widthSegments;
        const heightSegments = this.ground.geometry.parameters.heightSegments;
        
        // 将世界坐标转换为地形坐标
        const terrainX = (x + width / 2) / width * widthSegments;
        const terrainZ = (z + height / 2) / height * heightSegments;
        
        // 获取最近的四个顶点
        const x1 = Math.floor(terrainX);
        const z1 = Math.floor(terrainZ);
        const x2 = Math.min(x1 + 1, widthSegments);
        const z2 = Math.min(z1 + 1, heightSegments);
        
        // 双线性插值计算精确高度
        const xFrac = terrainX - x1;
        const zFrac = terrainZ - z1;
        
        // 获取顶点索引
        const i11 = (z1 * (widthSegments + 1)) + x1;
        const i12 = (z2 * (widthSegments + 1)) + x1;
        const i21 = (z1 * (widthSegments + 1)) + x2;
        const i22 = (z2 * (widthSegments + 1)) + x2;
        
        // 获取顶点高度
        const y11 = positionAttribute.getY(i11);
        const y12 = positionAttribute.getY(i12);
        const y21 = positionAttribute.getY(i21);
        const y22 = positionAttribute.getY(i22);
        
        // 双线性插值
        const y1 = y11 * (1 - xFrac) + y21 * xFrac;
        const y2 = y12 * (1 - xFrac) + y22 * xFrac;
        const y = y1 * (1 - zFrac) + y2 * zFrac;
        
        return y;
    }
    
    // 更新位置到地面上
    updatePositionToGround() {
        if (this.ground) {
            const groundHeight = this.getGroundHeight(this.position.x, this.position.z);
            this.position.y = groundHeight + this.height;
            this.yawObject.position.copy(this.position);
        }
    }
    
    // 获取玩家位置
    getPosition() {
        return this.position;
    }
    
    // 获取相机朝向
    getCameraOrientation() {
        return this.cameraOrientation;
    }
    
    // 设置相机朝向
    setCameraOrientation(orientation) {
        this.cameraOrientation = orientation;
    }
} 