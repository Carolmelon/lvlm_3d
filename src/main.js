import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Player } from './Player.js';
import { World } from './World.js';
import { loadingManager } from './utils/loadingManager.js';
import { Debug } from './utils/debug.js';

// 创建调试工具
const debug = new Debug();

// 基本的场景设置
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // 天空蓝

// 创建相机
// 创建透视相机
// 参数说明:
// 75 - 视场角(FOV)，表示相机视野的广度，单位是度
// window.innerWidth / window.innerHeight - 相机视口的宽高比，通常设置为屏幕宽高比
// 0.1 - 近裁剪面，比这个距离更近的物体不会被渲染
// 1000 - 远裁剪面，比这个距离更远的物体不会被渲染
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// 设置相机位置为原点
camera.position.set(0, 0, 0);

// 创建渲染器
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// 添加环境光和定向光
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(50, 200, 100);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 1024;
directionalLight.shadow.mapSize.height = 1024;
directionalLight.shadow.camera.near = 10;
directionalLight.shadow.camera.far = 500;
directionalLight.shadow.camera.left = -100;
directionalLight.shadow.camera.right = 100;
directionalLight.shadow.camera.top = 100;
directionalLight.shadow.camera.bottom = -100;
scene.add(directionalLight);

// 控制器（用于调试）
let controls = null;
const DEBUG_MODE = false;

// 创建世界
// 传入scene参数是为了让World类能够将生成的地形、树木、岩石等对象添加到场景中
// 传入loadingManager参数是为了管理纹理加载过程，提供加载进度反馈和错误处理
const world = new World(scene, loadingManager);

// 创建玩家
// 传入camera参数是为了将相机附加到玩家对象上，实现第一人称视角
// 传入world.getGround()参数是为了进行碰撞检测，确保玩家不会穿过地面
// 传入scene参数是为了管理模型的添加和移除
const player = new Player(camera, world.getGround(), scene);
player.pitchObject.position.y = 2; // 设置pitchObject的高度
scene.add(player.yawObject);

// 注册可碰撞对象
player.registerCollidableObjects(world.getCollidableObjects());

if (DEBUG_MODE) {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
}

// 添加调试信息
const infoElement = document.getElementById('info');
document.addEventListener('keydown', (event) => {
    if (event.code === 'KeyH') {
        infoElement.style.display = infoElement.style.display === 'none' ? 'block' : 'none';
    }
});

// 窗口大小调整处理
window.addEventListener('resize', () => {
    const newWidth = window.innerWidth;
    const newHeight = window.innerHeight;
    camera.aspect = newWidth / newHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(newWidth, newHeight);
});

// 记录时间
let prevTime = performance.now();
let frameCount = 0;
let fps = 0;
let lastFpsUpdate = 0;

// 添加视图模式切换功能
let viewMode = 'first-person'; // 'first-person' 或 'third-person'
// 保存原始第一人称旋转信息
let firstPersonRotation = {
    pitchX: 0,
    yawY: 0
};

// 添加相机距离控制参数
let thirdPersonDistance = 12; // 默认距离
const MIN_DISTANCE = 3; // 最小距离
const MAX_DISTANCE = 20; // 最大距离
const ZOOM_SPEED = 0.5; // 缩放速度

// 添加鼠标滚轮事件监听
document.addEventListener('wheel', (event) => {
    if (viewMode === 'third-person') {
        // deltaY 向上滚动为负，向下滚动为正
        thirdPersonDistance += event.deltaY * 0.01 * ZOOM_SPEED;
        
        // 限制距离范围
        thirdPersonDistance = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, thirdPersonDistance));
        
        console.log(`相机距离: ${thirdPersonDistance.toFixed(2)}`);
    }
});

// 添加鼠标移动事件监听
document.addEventListener('mousemove', (event) => {
    if (document.pointerLockElement === document.body) {
        if (viewMode === 'first-person') {
            // 第一人称模式：鼠标移动控制玩家旋转
            player.yawObject.rotation.y -= event.movementX * player.mouseSensitivity;
            player.pitchObject.rotation.x -= event.movementY * player.mouseSensitivity;
            
            // 限制俯仰角度，防止过度旋转
            player.pitchObject.rotation.x = Math.max(
                -Math.PI / 2, 
                Math.min(Math.PI / 2, player.pitchObject.rotation.x)
            );
        } else {
            // 第三人称模式：鼠标移动只控制相机朝向
            player.setCameraOrientation(player.getCameraOrientation() - event.movementX * player.mouseSensitivity);
        }
    }
});

// 初始化第三人称相机位置
function setupThirdPersonCamera() {
    // 设置相机位置在玩家后方
    const cameraOffset = new THREE.Vector3(0, 5, 10);
    // 应用当前相机朝向
    cameraOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), player.getCameraOrientation());
    // 设置相机位置（玩家位置 + 偏移）
    camera.position.copy(player.position).add(cameraOffset);
    // 让相机看向玩家
    camera.lookAt(player.position);
}

// 切换视图模式
document.addEventListener('keydown', (event) => {
    if (event.code === 'KeyT') {
        // 如果从第一人称切换到第三人称，先保存当前旋转
        if (viewMode === 'first-person') {
            firstPersonRotation.pitchX = player.pitchObject.rotation.x;
            firstPersonRotation.yawY = player.yawObject.rotation.y;
            
            // 初始化相机朝向与玩家朝向一致
            player.setCameraOrientation(player.yawObject.rotation.y);
        }
        
        viewMode = viewMode === 'first-person' ? 'third-person' : 'first-person';
        
        if (viewMode === 'third-person') {
            // 切换到第三人称
            player.pitchObject.remove(camera); // 从pitchObject移除相机
            scene.add(camera); // 将相机添加到场景
            setupThirdPersonCamera(); // 设置第三人称相机位置
            
            // 显示角色模型
            if (player.model) {
                player.model.visible = true;
                // 调整模型位置到地面
                player.model.position.y = -player.height + 0.5;
            }
        } else {
            // 切换到第一人称
            scene.remove(camera); // 从场景移除相机
            
            // 重置相机和旋转
            camera.position.set(0, 0, 0);
            camera.rotation.set(0, 0, 0);
            
            // 恢复原始旋转
            player.pitchObject.rotation.x = firstPersonRotation.pitchX;
            player.yawObject.rotation.y = firstPersonRotation.yawY;
            
            // 将相机添加回pitchObject
            player.pitchObject.add(camera);
            
            // 隐藏角色模型
            if (player.model) {
                player.model.visible = false;
            }
        }
        
        console.log(`切换到${viewMode === 'first-person' ? '第一人称' : '第三人称'}视图`);
    }
});

// 动画循环
function animate() {
    // requestAnimationFrame是浏览器提供的一个API，用于在下一次重绘之前调用指定的回调函数
    // 它比setTimeout更适合实现动画，因为它会在浏览器重绘前执行，保证动画流畅
    // 当页面不可见时（如切换标签页），浏览器会暂停执行，从而节省CPU资源
    // 它会传递一个时间戳参数给回调函数，可用于计算动画的下一帧
    // 返回值是一个请求ID，可以传递给cancelAnimationFrame()来取消回调
    requestAnimationFrame(animate);
    
    const time = performance.now();
    const delta = (time - prevTime) / 1000; // 转换为秒
    prevTime = time;
    
    // 计算FPS
    frameCount++;
    if (time - lastFpsUpdate > 1000) { // 每秒更新一次
        fps = Math.round(frameCount * 1000 / (time - lastFpsUpdate));
        frameCount = 0;
        lastFpsUpdate = time;
    }
    
    // 更新玩家
    if (!DEBUG_MODE) {
        // 根据视图模式更新Player的update方法
        player.update(delta, viewMode);
    }
    
    // 更新第三人称相机位置
    if (viewMode === 'third-person') {
        // 计算理想的相机位置（从后上方观察）
        const idealOffset = new THREE.Vector3(
            0, 
            thirdPersonDistance * 0.6, // 高度随距离变化
            thirdPersonDistance
        );
        
        // 应用相机朝向（而不是玩家朝向）
        idealOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), player.getCameraOrientation());
        idealOffset.add(player.position);
        
        // 平滑过渡到理想位置
        camera.position.lerp(idealOffset, 0.1);
        
        // 让相机看向玩家上方一点的位置
        const targetPosition = player.position.clone();
        targetPosition.y += 1.5;
        camera.lookAt(targetPosition);
    }
    
    // 更新世界
    world.update(delta, player.getPosition());
    
    // 更新控制器
    if (DEBUG_MODE && controls) {
        controls.update();
    }
    
    // 更新调试信息
    debug.update({
        fps: fps,
        position: {
            x: player.position.x.toFixed(2),
            y: player.position.y.toFixed(2),
            z: player.position.z.toFixed(2)
        },
        controls: {
            forward: player.keys.forward,
            backward: player.keys.backward,
            left: player.keys.left,
            right: player.keys.right,
            jump: player.keys.jump,
            crouch: player.keys.crouch
        },
        collisions: player.collidableObjects.length, // 显示碰撞对象数量
        standing: player.isJumping ? "空中" : (player.isCrouching ? "下蹲" : "站立"), // 显示玩家状态
        locked: document.pointerLockElement === document.body
    });
    
    // 渲染场景
    renderer.render(scene, camera);
}

// 加载完成后开始游戏
loadingManager.onLoad = () => {
    document.getElementById('loading').style.display = 'none';
    console.log('游戏已加载，点击屏幕开始玩！');
    animate();
}; 