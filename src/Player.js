import * as THREE from 'three';

export class Player {
    constructor(camera, ground) {
        // 玩家参数
        this.camera = camera;
        this.ground = ground;
        this.moveSpeed = 10;
        this.jumpForce = 10;
        this.gravity = 20;
        
        // 玩家状态
        this.position = new THREE.Vector3(0, 0, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.direction = new THREE.Vector3(0, 0, 0);
        this.isJumping = false;
        this.height = 1.8; // 玩家高度
        
        // 输入控制
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            jump: false
        };
        
        // 鼠标控制
        this.mouseSensitivity = 0.002;
        this.pitchObject = new THREE.Object3D(); // 俯仰（上下看）
        this.yawObject = new THREE.Object3D(); // 偏航（左右看）
        
        this.pitchObject.add(camera);
        this.yawObject.add(this.pitchObject);
        
        // 初始化
        this.init();
    }
    
    init() {
        // 添加键盘事件监听
        document.addEventListener('keydown', this.onKeyDown.bind(this), false);
        document.addEventListener('keyup', this.onKeyUp.bind(this), false);
        
        // 添加鼠标事件监听
        document.addEventListener('mousemove', this.onMouseMove.bind(this), false);
        
        // 锁定鼠标指针
        document.addEventListener('click', () => {
            document.body.requestPointerLock();
        });
        
        // 显示锁定状态的提示
        document.addEventListener('pointerlockchange', () => {
            if (document.pointerLockElement === document.body) {
                console.log('鼠标已锁定');
            } else {
                console.log('鼠标已解锁');
            }
        });
        
        // 更新初始位置到地面上
        this.updatePositionToGround();
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
        }
    }
    
    onMouseMove(event) {
        if (document.pointerLockElement === document.body) {
            // 应用鼠标移动到摄像机旋转
            this.yawObject.rotation.y -= event.movementX * this.mouseSensitivity;
            this.pitchObject.rotation.x -= event.movementY * this.mouseSensitivity;
            
            // 限制俯仰角度，防止过度旋转
            this.pitchObject.rotation.x = Math.max(
                -Math.PI / 2, 
                Math.min(Math.PI / 2, this.pitchObject.rotation.x)
            );
        }
    }
    
    update(delta) {
        if (!this.ground) return;
        
        // 输出玩家状态，用于调试
        if (this.keys.forward || this.keys.backward || this.keys.left || this.keys.right) {
            console.log('移动状态:', this.keys);
        }
        
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
        
        // 应用相机朝向到移动方向
        const rotationMatrix = new THREE.Matrix4();
        rotationMatrix.makeRotationY(this.yawObject.rotation.y);
        this.direction.applyMatrix4(rotationMatrix);
        
        // 应用重力和跳跃
        this.velocity.y -= this.gravity * delta;
        
        if (this.keys.jump && !this.isJumping) {
            this.velocity.y = this.jumpForce;
            this.isJumping = true;
        }
        
        // 应用速度到位置
        this.position.x += this.direction.x * this.moveSpeed * delta;
        this.position.z += this.direction.z * this.moveSpeed * delta;
        this.position.y += this.velocity.y * delta;
        
        // 检测与地面的碰撞
        const groundHeight = this.getGroundHeight(this.position.x, this.position.z);
        
        // 如果在地面以下，将位置调整到地面上
        if (this.position.y <= groundHeight + this.height) {
            this.position.y = groundHeight + this.height;
            this.velocity.y = 0;
            this.isJumping = false;
        }
        
        // 更新相机位置
        this.yawObject.position.copy(this.position);
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
} 