import * as THREE from 'three';
import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise.js';

export class World {
    constructor(scene, loadingManager) {
        this.scene = scene;
        this.loadingManager = loadingManager;
        this.objects = [];
        this.trees = [];
        this.rocks = [];
        this.ground = null;
        this.terrainSize = 500;
        this.noise = new SimplexNoise();
        
        this.init();
    }
    
    init() {
        // 创建地形
        this.createTerrain();
        
        // 创建天空盒
        this.createSkybox();
        
        // 创建植被和岩石
        this.createVegetation();
    }
    
    createTerrain() {
        // 使用噪声生成高度图
        const resolution = 128;
        const size = this.terrainSize;
        const geometry = new THREE.PlaneGeometry(size, size, resolution, resolution);
        geometry.rotateX(-Math.PI / 2);
        
        // 应用高度图
        const heightScale = 20;
        const vertices = geometry.attributes.position.array;
        
        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i];
            const z = vertices[i + 2];
            
            // 使用噪声函数生成高度
            const nx = x / size;
            const nz = z / size;
            
            // 多层次噪声以创建更自然的地形
            const height = 
                this.noise.noise(nx * 1, nz * 1) * 0.5 + 
                this.noise.noise(nx * 2, nz * 2) * 0.3 +
                this.noise.noise(nx * 4, nz * 4) * 0.2;
                
            vertices[i + 1] = height * heightScale;
        }
        
        // 重新计算顶点法线以获得正确的光照
        geometry.computeVertexNormals();
        
        // 创建地形材质
        const groundTexture = new THREE.TextureLoader(this.loadingManager).load(
            'https://threejs.org/examples/textures/terrain/grasslight-big.jpg'
        );
        groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping;
        groundTexture.repeat.set(25, 25);
        groundTexture.anisotropy = 16;
        
        const terrainMaterial = new THREE.MeshStandardMaterial({
            map: groundTexture,
            roughness: 0.8,
            metalness: 0.1
        });
        
        // 创建地形网格
        this.ground = new THREE.Mesh(geometry, terrainMaterial);
        this.ground.castShadow = false;
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);
        
        // 为碰撞检测添加地形辅助对象
        this.objects.push(this.ground);
    }
    
    createSkybox() {
        // 使用纯色作为默认天空盒
        // 在实际项目中，可以用六面纹理贴图创建真正的天空盒
        this.scene.background = new THREE.Color(0x87CEEB);
        
        // 添加远处的雾效来模拟大气效果
        this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.002);
    }
    
    createVegetation() {
        // 创建树木
        this.createTrees(100);
        
        // 创建岩石
        this.createRocks(50);
    }
    
    createTrees(count) {
        // 简单的树木 - 圆柱体树干和圆锥体树冠
        const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.7, 2, 8);
        const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        
        const leavesGeometry = new THREE.ConeGeometry(2, 4, 8);
        const leavesMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 });
        
        for (let i = 0; i < count; i++) {
            // 随机位置
            const x = (Math.random() - 0.5) * this.terrainSize * 0.8;
            const z = (Math.random() - 0.5) * this.terrainSize * 0.8;
            
            // 获取地形高度
            const height = this.getHeightAt(x, z);
            
            // 创建树干
            const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
            trunk.position.set(x, height + 1, z);
            trunk.castShadow = true;
            trunk.receiveShadow = true;
            this.scene.add(trunk);
            
            // 创建树冠
            const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
            leaves.position.set(x, height + 4, z);
            leaves.castShadow = true;
            leaves.receiveShadow = true;
            this.scene.add(leaves);
            
            // 将树添加到集合中
            this.trees.push({ trunk, leaves, position: new THREE.Vector3(x, height, z) });
        }
    }
    
    createRocks(count) {
        const rockGeometry = new THREE.DodecahedronGeometry(1, 0);
        const rockMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x888888,
            roughness: 0.9,
            metalness: 0.1 
        });
        
        for (let i = 0; i < count; i++) {
            // 随机位置
            const x = (Math.random() - 0.5) * this.terrainSize * 0.8;
            const z = (Math.random() - 0.5) * this.terrainSize * 0.8;
            
            // 获取地形高度
            const height = this.getHeightAt(x, z);
            
            // 创建不同大小的岩石
            const scale = 0.5 + Math.random() * 1.5;
            const rock = new THREE.Mesh(rockGeometry, rockMaterial);
            rock.position.set(x, height + scale * 0.5, z);
            rock.scale.set(scale, scale, scale);
            
            // 随机旋转
            rock.rotation.x = Math.random() * Math.PI;
            rock.rotation.y = Math.random() * Math.PI;
            rock.rotation.z = Math.random() * Math.PI;
            
            rock.castShadow = true;
            rock.receiveShadow = true;
            this.scene.add(rock);
            
            // 将岩石添加到集合中
            this.rocks.push({ mesh: rock, position: new THREE.Vector3(x, height, z) });
        }
    }
    
    // 根据x,z坐标计算地形高度
    getHeightAt(x, z) {
        if (!this.ground) return 0;
        
        // 转换到地形坐标
        const nx = x / this.terrainSize;
        const nz = z / this.terrainSize;
        
        // 使用与地形创建相同的噪声函数
        const heightScale = 20;
        const height = 
            this.noise.noise(nx * 1, nz * 1) * 0.5 + 
            this.noise.noise(nx * 2, nz * 2) * 0.3 +
            this.noise.noise(nx * 4, nz * 4) * 0.2;
            
        return height * heightScale;
    }
    
    // 更新世界
    update(delta, playerPosition) {
        // 这里可以添加动态世界元素的更新
        // 例如：树叶摇曳、水流动画等
        
        // 实现简单的"无限"世界 - 当玩家移动时，世界会更新
        // 在实际游戏中，可以实现更复杂的区块加载系统
    }
    
    // 获取地面对象（用于碰撞检测）
    getGround() {
        return this.ground;
    }

    // 新增: 获取环境状态信息
    getEnvironmentState() {
        return {
            terrain: {
                size: this.terrainSize,
                heightMap: this.serializeHeightMap()
            },
            objects: {
                trees: this.trees.map(tree => ({
                    position: {
                        x: tree.position.x,
                        y: tree.position.y,
                        z: tree.position.z
                    },
                    type: 'tree'
                })),
                rocks: this.rocks.map(rock => ({
                    position: {
                        x: rock.position.x,
                        y: rock.position.y,
                        z: rock.position.z
                    },
                    scale: rock.mesh.scale.x,
                    type: 'rock'
                }))
            },
            time: Date.now()
        };
    }
    
    // 新增: 序列化高度图数据（简化版）
    serializeHeightMap() {
        if (!this.ground || !this.ground.geometry) {
            return { error: '地形未初始化' };
        }
        
        // 简化高度图数据，只返回采样点
        const sampleSize = 16; // 采样间隔，减少数据量
        const positions = this.ground.geometry.attributes.position;
        const widthSegments = Math.sqrt(positions.count) - 1;
        const heightSegments = widthSegments;
        
        const samples = [];
        
        for (let z = 0; z <= heightSegments; z += sampleSize) {
            for (let x = 0; x <= widthSegments; x += sampleSize) {
                const index = z * (widthSegments + 1) + x;
                if (index < positions.count) {
                    samples.push({
                        x: positions.getX(index),
                        y: positions.getY(index),
                        z: positions.getZ(index)
                    });
                }
            }
        }
        
        return {
            samples: samples,
            width: this.terrainSize,
            height: this.terrainSize,
            widthSegments: widthSegments,
            heightSegments: heightSegments,
            sampleSize: sampleSize
        };
    }
    
    // 新增: 获取两点之间的路径
    getPathBetween(startX, startZ, endX, endZ, maxSteps = 10) {
        const path = [];
        
        // 起点和终点高度
        const startY = this.getHeightAt(startX, startZ);
        const endY = this.getHeightAt(endX, endZ);
        
        path.push({x: startX, y: startY, z: startZ});
        
        // 计算直线距离
        const distance = Math.sqrt(
            Math.pow(endX - startX, 2) + 
            Math.pow(endZ - startZ, 2)
        );
        
        // 根据距离确定步数，但不超过maxSteps
        const steps = Math.min(Math.max(2, Math.ceil(distance / 10)), maxSteps);
        
        // 生成中间点
        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            const x = startX + (endX - startX) * t;
            const z = startZ + (endZ - startZ) * t;
            const y = this.getHeightAt(x, z);
            
            path.push({x, y, z});
        }
        
        path.push({x: endX, y: endY, z: endZ});
        
        return path;
    }
    
    // 新增: 查找最近的特定类型对象
    findNearestObject(x, z, type = 'tree', maxDistance = 100) {
        let nearest = null;
        let minDistance = maxDistance;
        
        const objectsToSearch = type === 'tree' ? this.trees : 
                               type === 'rock' ? this.rocks : 
                               [...this.trees, ...this.rocks];
        
        for (const obj of objectsToSearch) {
            const position = obj.position;
            const distance = Math.sqrt(
                Math.pow(position.x - x, 2) + 
                Math.pow(position.z - z, 2)
            );
            
            if (distance < minDistance) {
                minDistance = distance;
                nearest = {
                    type: type === 'tree' || obj.trunk ? 'tree' : 'rock',
                    position: position.clone(),
                    distance: distance
                };
            }
        }
        
        return nearest;
    }
    
    // 新增: 检查位置是否可访问(没有障碍物)
    isPositionAccessible(x, y, z) {
        // 简化检查，只确保位置在地形范围内
        const halfSize = this.terrainSize / 2;
        if (x < -halfSize || x > halfSize || z < -halfSize || z > halfSize) {
            return false;
        }
        
        // 检查位置是否有足够高度（防止陷入地下）
        const groundHeight = this.getHeightAt(x, z);
        if (y < groundHeight) {
            return false;
        }
        
        // 检查是否与树木碰撞
        for (const tree of this.trees) {
            const distance = Math.sqrt(
                Math.pow(tree.position.x - x, 2) + 
                Math.pow(tree.position.z - z, 2)
            );
            
            // 树木碰撞半径设为2
            if (distance < 2) {
                return false;
            }
        }
        
        // 检查是否与岩石碰撞
        for (const rock of this.rocks) {
            const distance = Math.sqrt(
                Math.pow(rock.position.x - x, 2) + 
                Math.pow(rock.position.z - z, 2)
            );
            
            // 岩石碰撞半径设为岩石大小的1.5倍
            if (distance < rock.mesh.scale.x * 1.5) {
                return false;
            }
        }
        
        return true;
    }
} 