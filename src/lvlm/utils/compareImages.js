/**
 * 图像比较工具 - 用于比较环境截图
 * 
 * 注意：这是一个简化实现，仅用于演示
 * 实际应用中可能需要使用更高级的计算机视觉库或服务
 */

/**
 * 比较两个图像的相似度
 * @param {string} img1DataUrl - 第一个图像的Data URL
 * @param {string} img2DataUrl - 第二个图像的Data URL
 * @returns {Promise<Object>} - 比较结果
 */
export function compareImages(img1DataUrl, img2DataUrl) {
  return new Promise((resolve, reject) => {
    // 创建图像元素
    const img1 = new Image();
    const img2 = new Image();
    
    // 当两个图像都加载完成后进行比较
    let imagesLoaded = 0;
    
    const onImageLoad = () => {
      imagesLoaded++;
      if (imagesLoaded === 2) {
        try {
          // 创建canvas并绘制图像
          const canvas1 = document.createElement('canvas');
          const canvas2 = document.createElement('canvas');
          
          canvas1.width = img1.width;
          canvas1.height = img1.height;
          canvas2.width = img2.width;
          canvas2.height = img2.height;
          
          const ctx1 = canvas1.getContext('2d');
          const ctx2 = canvas2.getContext('2d');
          
          ctx1.drawImage(img1, 0, 0);
          ctx2.drawImage(img2, 0, 0);
          
          // 获取图像数据
          const imageData1 = ctx1.getImageData(0, 0, canvas1.width, canvas1.height);
          const imageData2 = ctx2.getImageData(0, 0, canvas2.width, canvas2.height);
          
          // 如果尺寸不同，返回差异很大
          if (canvas1.width !== canvas2.width || canvas1.height !== canvas2.height) {
            resolve({
              similar: false,
              similarity: 0,
              message: '图像尺寸不同'
            });
            return;
          }
          
          // 计算像素差异
          const data1 = imageData1.data;
          const data2 = imageData2.data;
          let diffCount = 0;
          
          // 仅比较部分像素点以提高性能(每10个像素采样一个)
          const sampleStep = 10;
          let sampledPixels = 0;
          
          for (let i = 0; i < data1.length; i += 4 * sampleStep) {
            const r1 = data1[i];
            const g1 = data1[i + 1];
            const b1 = data1[i + 2];
            
            const r2 = data2[i];
            const g2 = data2[i + 1];
            const b2 = data2[i + 2];
            
            // 计算RGB差异
            const diff = Math.sqrt(
              Math.pow(r1 - r2, 2) + 
              Math.pow(g1 - g2, 2) + 
              Math.pow(b1 - b2, 2)
            );
            
            // 如果差异大于阈值，计为不同像素
            if (diff > 30) { // 阈值可调整
              diffCount++;
            }
            
            sampledPixels++;
          }
          
          // 计算相似度百分比
          const similarity = 100 - (diffCount / sampledPixels * 100);
          
          resolve({
            similar: similarity > 90, // 相似度阈值可调整
            similarity: similarity,
            message: `图像相似度: ${similarity.toFixed(2)}%`
          });
        } catch (error) {
          reject(error);
        }
      }
    };
    
    // 设置加载事件和错误处理
    img1.onload = onImageLoad;
    img2.onload = onImageLoad;
    
    img1.onerror = () => reject(new Error('无法加载第一个图像'));
    img2.onerror = () => reject(new Error('无法加载第二个图像'));
    
    // 设置图像源
    img1.src = img1DataUrl;
    img2.src = img2DataUrl;
  });
}

/**
 * 检查图像是否包含特定颜色的区域
 * @param {string} imageDataUrl - 图像的Data URL
 * @param {Object} color - RGB颜色对象 {r, g, b}
 * @param {number} threshold - 颜色匹配阈值
 * @returns {Promise<Object>} - 检查结果
 */
export function detectColorInImage(imageDataUrl, color, threshold = 30) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        let matchCount = 0;
        
        // 每10个像素采样一个
        const sampleStep = 10;
        let sampledPixels = 0;
        
        for (let i = 0; i < data.length; i += 4 * sampleStep) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          // 计算与目标颜色的差异
          const diff = Math.sqrt(
            Math.pow(r - color.r, 2) + 
            Math.pow(g - color.g, 2) + 
            Math.pow(b - color.b, 2)
          );
          
          // 如果差异小于阈值，计为匹配像素
          if (diff < threshold) {
            matchCount++;
          }
          
          sampledPixels++;
        }
        
        // 计算匹配像素比例
        const matchRatio = matchCount / sampledPixels;
        
        resolve({
          containsColor: matchRatio > 0.05, // 如果超过5%的像素匹配，则认为包含该颜色
          matchRatio: matchRatio,
          message: `颜色匹配率: ${(matchRatio * 100).toFixed(2)}%`
        });
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => reject(new Error('无法加载图像'));
    
    img.src = imageDataUrl;
  });
}

/**
 * 简单的对象检测（基于特定颜色的区域检测）
 * 注意：这是一个非常简化的实现，实际应用中应使用真正的对象检测算法
 * 
 * @param {string} imageDataUrl - 图像的Data URL
 * @param {Object} objectSpec - 对象规格(颜色和大小)
 * @returns {Promise<Object>} - 检测结果
 */
export function detectObjectInImage(imageDataUrl, objectSpec) {
  // 使用颜色检测作为简化示例
  return detectColorInImage(imageDataUrl, objectSpec.color, objectSpec.threshold);
}

/**
 * 检查图像是否包含文本（仅做占位，需要OCR功能）
 * @param {string} imageDataUrl - 图像的Data URL
 * @param {string} text - 要检测的文本
 * @returns {Promise<Object>} - 检查结果
 */
export function detectTextInImage(imageDataUrl, text) {
  // 这个功能需要OCR库或API支持
  // 示例返回
  return Promise.resolve({
    containsText: false,
    message: '文本检测功能需要OCR支持'
  });
} 