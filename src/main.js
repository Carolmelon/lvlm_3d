import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Player } from './Player.js';
import { World } from './World.js';
import { loadingManager } from './utils/loadingManager.js';
import { Debug } from './utils/debug.js';
import { setupAPI } from './lvlm/API.js';

// 创建调试工具
const debug = new Debug();

// 基本的场景设置
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // 天空蓝

// 创建相机
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 2, 5);

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
const world = new World(scene, loadingManager);

// 创建玩家
const player = new Player(camera, world.getGround());
// 将玩家视角控制器添加到场景中
scene.add(player.yawObject);

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

// 动画循环
function animate() {
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
        player.update(delta);
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
            right: player.keys.right
        },
        locked: document.pointerLockElement === document.body
    });
    
    // 渲染场景
    renderer.render(scene, camera);
}

// 修改加载完成事件
loadingManager.onLoad = () => {
    document.getElementById('loading').style.display = 'none';
    console.log('游戏已加载，点击屏幕开始玩！');
    
    // 初始化LVLM API接口
    setupAPI(world, player, renderer, scene, camera);
    
    // 更新起始提示
    const startPrompt = document.getElementById('start-prompt');
    startPrompt.innerHTML = '点击此处开始游戏<br>（锁定鼠标指针）<br><span style="font-size:12px;">提示: 按Ctrl+L打开LVLM控制面板</span>';
    
    // 开始动画循环
    animate();
}; 