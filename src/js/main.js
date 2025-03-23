import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { GUI } from 'lil-gui';
import { gsap } from 'gsap';

// 导入自定义着色器
// 这里使用直接定义着色器代码的方式，避免导入错误
const atmosphereVertexShader = `
uniform vec3 sunPosition;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying float vSunIntensity;

void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    
    // 计算太阳光照强度
    vec3 worldSunPosition = sunPosition;
    vec3 worldNormal = normalize(mat3(modelMatrix) * normal);
    vec3 sunDir = normalize(worldSunPosition - worldPosition.xyz);
    vSunIntensity = max(0.0, dot(worldNormal, sunDir));
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const atmosphereFragmentShader = `
uniform vec3 glowColor;
uniform float atmosphereIntensity;
uniform vec3 sunPosition;

varying vec3 vNormal;
varying vec3 vWorldPosition;
varying float vSunIntensity;

// Rayleigh散射近似
vec3 rayleighScattering(float cosTheta) {
    vec3 beta = vec3(5.8e-6, 13.5e-6, 33.1e-6); // 大气散射系数
    return 0.75 * (1.0 + cosTheta * cosTheta) * beta;
}

void main() {
    // 视线方向
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    
    // 使用Fresnel效应计算大气透明度
    float fresnel = pow(1.0 - dot(viewDirection, vNormal), 2.8) * atmosphereIntensity;
    
    // 与太阳的夹角
    vec3 sunDir = normalize(sunPosition - vWorldPosition);
    float cosTheta = dot(viewDirection, sunDir);
    
    // 计算Rayleigh散射
    vec3 rayleigh = rayleighScattering(cosTheta);
    
    // 白天和夜晚的大气效果
    vec3 dayColor = mix(vec3(0.3, 0.6, 1.0), vec3(0.2, 0.5, 1.0), 1.0 - vSunIntensity); // 蓝色调
    vec3 nightColor = mix(vec3(0.1, 0.1, 0.2), vec3(0.05, 0.05, 0.1), 1.0 - vSunIntensity); // 深蓝色调
    
    // 根据太阳光照强度混合白天和夜晚颜色
    vec3 atmosphereColor = mix(nightColor, dayColor, smoothstep(0.0, 0.3, vSunIntensity));
    
    // 最终颜色
    vec3 finalColor = atmosphereColor + rayleigh * vSunIntensity * 10.0;
    
    // 透明度随视线和表面法线夹角变化
    gl_FragColor = vec4(finalColor, fresnel);
}
`;

class SolarSystemApp {
  constructor() {
    this.canvas = document.querySelector('canvas.webgl');
    this.loadingScreen = document.querySelector('.loading-screen');
    this.infoPanel = document.querySelector('.info-panel');
    this.planetNameEl = document.getElementById('planet-name');
    this.planetInfoEl = document.getElementById('planet-info');
    
    this.scene = new THREE.Scene();
    this.textureLoader = new THREE.TextureLoader();
    this.textureLoader.setPath('./src/assets/textures/');
    
    this.sizes = {
      width: window.innerWidth,
      height: window.innerHeight
    };
    
    this.mouse = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.clock = new THREE.Clock();
    this.elapsedTime = 0;
    
    this.camera = this.createCamera();
    this.renderer = this.createRenderer();
    this.controls = this.createControls();
    this.composer = this.createComposer();
    
    // 加载贴图
    this.loadTextures().then(() => {
      this.createSolarSystem();
      this.addEventListeners();
      this.createGUI();
      this.hideLoading();
      this.animate();
    });
  }
  
  loadTextures() {
    console.log('开始加载贴图...');
    const texturePromises = [
      this.loadTexture('2k_stars_milky_way.jpg'),
      this.loadTexture('2k_sun.jpg'),
      this.loadTexture('2k_earth_daymap.jpg'),
      this.loadTexture('2k_earth_normal_map.jpg'),
      this.loadTexture('2k_earth_specular_map.jpg'),
      this.loadTexture('2k_earth_clouds.jpg'),
      this.loadTexture('2k_moon.jpg')
    ];
    
    return Promise.all(texturePromises).then(textures => {
      console.log('所有贴图加载完成!');
      this.textures = {
        stars: textures[0],
        sun: textures[1],
        earthDay: textures[2],
        earthNormal: textures[3],
        earthSpecular: textures[4],
        earthClouds: textures[5],
        moon: textures[6]
      };
    }).catch(error => {
      console.error('贴图加载失败:', error);
      // 即使贴图加载失败也继续初始化
      this.textures = {};
      this.createSolarSystem();
      this.addEventListeners();
      this.createGUI();
      this.hideLoading();
      this.animate();
    });
  }
  
  loadTexture(name) {
    console.log(`尝试加载贴图: ${name}`);
    return new Promise((resolve, reject) => {
      this.textureLoader.load(
        name,
        texture => {
          console.log(`贴图加载成功: ${name}`);
          resolve(texture);
        },
        undefined,
        error => {
          console.error(`贴图加载失败: ${name}`, error);
          // 创建一个替代纹理
          const canvas = document.createElement('canvas');
          canvas.width = 512;
          canvas.height = 512;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            if (name.includes('sun')) {
              // 创建太阳替代纹理
              ctx.fillStyle = '#FDB813';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
            } else if (name.includes('earth')) {
              // 创建地球替代纹理
              ctx.fillStyle = '#2C5D9C';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              if (name.includes('clouds')) {
                // 云层纹理
                ctx.globalAlpha = 0.5;
                ctx.fillStyle = '#FFFFFF';
                for (let i = 0; i < 20; i++) {
                  const x = Math.random() * canvas.width;
                  const y = Math.random() * canvas.height;
                  const r = 10 + Math.random() * 30;
                  ctx.beginPath();
                  ctx.arc(x, y, r, 0, Math.PI * 2);
                  ctx.fill();
                }
              }
            } else if (name.includes('moon')) {
              // 创建月球替代纹理
              ctx.fillStyle = '#CCCCCC';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
            } else if (name.includes('stars')) {
              // 创建星空替代纹理
              ctx.fillStyle = '#000000';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.fillStyle = '#FFFFFF';
              for (let i = 0; i < 1000; i++) {
                const x = Math.random() * canvas.width;
                const y = Math.random() * canvas.height;
                const r = Math.random() * 2;
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.fill();
              }
            }
            
            const texture = new THREE.CanvasTexture(canvas);
            console.log(`已创建替代纹理: ${name}`);
            resolve(texture);
          } else {
            reject(error);
          }
        }
      );
    });
  }
  
  createCamera() {
    const camera = new THREE.PerspectiveCamera(45, this.sizes.width / this.sizes.height, 0.1, 2000);
    camera.position.set(0, 15, 30);
    return camera;
  }
  
  createRenderer() {
    const renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true
    });
    
    renderer.setSize(this.sizes.width, this.sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    
    return renderer;
  }
  
  createControls() {
    const controls = new OrbitControls(this.camera, this.canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 5;
    controls.maxDistance = 100;
    
    return controls;
  }
  
  createComposer() {
    const renderPass = new RenderPass(this.scene, this.camera);
    
    const composer = new EffectComposer(this.renderer);
    composer.addPass(renderPass);
    
    return composer;
  }
  
  createSolarSystem() {
    // 创建星空背景
    this.createStarfield();
    
    // 创建太阳
    this.createSun();
    
    // 创建水平的黄道面（不再倾斜）
    this.eclipticGroup = new THREE.Group();
    // 黄道面现在完全水平
    this.scene.add(this.eclipticGroup);
    
    // 在水平黄道面上创建地球轨道
    this.createEarth();
    
    // 创建月球
    this.createMoon();
  }
  
  createStarfield() {
    const geometry = new THREE.SphereGeometry(1000, 64, 64);
    const material = new THREE.MeshBasicMaterial({
      map: this.textures.stars,
      side: THREE.BackSide
    });
    
    const starfield = new THREE.Mesh(geometry, material);
    this.scene.add(starfield);
  }
  
  createSun() {
    // 创建太阳球体
    const sunGeometry = new THREE.SphereGeometry(5, 64, 64);
    const sunMaterial = new THREE.MeshBasicMaterial({
      map: this.textures.sun,
      color: 0xffff00
    });
    
    this.sun = new THREE.Mesh(sunGeometry, sunMaterial);
    this.sun.name = 'sun';
    this.scene.add(this.sun);
    
    // 添加太阳光源 - 显著增强光照强度
    this.sunLight = new THREE.PointLight(0xffffff, 5.0, 1000);
    this.sunLight.position.set(0, 0, 0);
    this.scene.add(this.sunLight);
    
    // 添加光晕效果
    const sunGlowGeometry = new THREE.SphereGeometry(5.2, 32, 32);
    const sunGlowMaterial = new THREE.ShaderMaterial({
      uniforms: {
        glowColor: { value: new THREE.Color(0xffff00) },
        atmosphereIntensity: { value: 1.5 },
        sunPosition: { value: new THREE.Vector3(0, 0, 0) }
      },
      vertexShader: atmosphereVertexShader,
      fragmentShader: atmosphereFragmentShader,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false
    });
    
    const sunGlow = new THREE.Mesh(sunGlowGeometry, sunGlowMaterial);
    this.sun.add(sunGlow);
  }
  
  createEarth() {
    // 创建地球组 - 添加到水平黄道面
    this.earthGroup = new THREE.Group();
    this.eclipticGroup.add(this.earthGroup);
    
    // 创建地球轨道 - 现在使用椭圆而不是圆形
    const earthOrbitRadius = 20;
    const earthOrbitEccentricity = 0.25; // 增大离心率，从0.0167增加到0.25，使椭圆更明显
    const earthOrbitSemiMinorAxis = earthOrbitRadius * Math.sqrt(1 - earthOrbitEccentricity * earthOrbitEccentricity);
    
    // 创建自定义轨道点集合
    const orbitPoints = [];
    for (let i = 0; i <= 360; i++) {
      const angle = i * Math.PI / 180;
      const r = (earthOrbitRadius * (1 - earthOrbitEccentricity * earthOrbitEccentricity)) / (1 + earthOrbitEccentricity * Math.cos(angle));
      // 翻转x轴方向，对换近日点和远日点位置
      const x = -r * Math.cos(angle);
      const z = r * Math.sin(angle);
      orbitPoints.push(new THREE.Vector3(x, 0, z));
    }
    
    // 创建椭圆轨道曲线
    const orbitCurve = new THREE.CatmullRomCurve3(orbitPoints);
    const orbitGeometry = new THREE.TubeGeometry(orbitCurve, 200, 0.05, 8, true);
    
    const earthOrbitMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x4488aa, 
      transparent: true, 
      opacity: 0.3,
      side: THREE.DoubleSide
    });
    
    this.earthOrbit = new THREE.Mesh(orbitGeometry, earthOrbitMaterial);
    this.eclipticGroup.add(this.earthOrbit);
    
    // 计算太阳焦点偏移量
    const sunOffset = earthOrbitRadius * earthOrbitEccentricity;
    
    // 添加近日点和远日点标记 - 对换位置
    const perihelionPosition = new THREE.Vector3(
      -earthOrbitRadius * (1 - earthOrbitEccentricity), 
      0, 
      0
    );
    
    const aphelionPosition = new THREE.Vector3(
      earthOrbitRadius * (1 + earthOrbitEccentricity), 
      0, 
      0
    );
    
    // 更正冬至点和夏至点的位置
    // 当北半球面向太阳时为夏至(对于现代地球，夏至点接近远日点)
    // 当北半球背向太阳时为冬至(对于现代地球，冬至点接近近日点)
    
    // 计算椭圆轨道上的具体点
    const calcOrbitPoint = (angle) => {
      const r = (earthOrbitRadius * (1 - earthOrbitEccentricity * earthOrbitEccentricity)) / 
                (1 + earthOrbitEccentricity * Math.cos(angle));
      return new THREE.Vector3(
        -r * Math.cos(angle), 
        0, 
        r * Math.sin(angle)
      );
    };
    
    // 冬至点位于近日点附近，大约12月21日，比近日点(1月3日)提前约13天
    // 一年365天，差13天约为13/365 = 0.036的轨道角度，约为0.036 * 2π = 0.226弧度
    const winterSolsticeAngle = 0 + 0.226; // 近日点角度0加上偏移
    const winterSolsticePosition = calcOrbitPoint(winterSolsticeAngle);
    
    // 夏至点位于远日点附近，大约6月21日，比远日点(7月4日)提前约13天
    // 远日点角度为π，减去相同的偏移
    const summerSolsticeAngle = Math.PI - 0.226;
    const summerSolsticePosition = calcOrbitPoint(summerSolsticeAngle);
    
    // 创建近日点标记
    const markerGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const perihelionMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    this.perihelionMarker = new THREE.Mesh(markerGeometry, perihelionMaterial);
    this.perihelionMarker.position.copy(perihelionPosition);
    this.eclipticGroup.add(this.perihelionMarker);
    
    // 创建近日点标签
    const createTextSprite = (text, position, color) => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 128;
      const context = canvas.getContext('2d');
      context.fillStyle = 'rgba(0, 0, 0, 0)';
      context.fillRect(0, 0, canvas.width, canvas.height);
      
      context.font = 'Bold 32px Arial';
      context.fillStyle = color;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(text, 128, 64);
      
      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      
      const spriteMaterial = new THREE.SpriteMaterial({ 
        map: texture,
        transparent: true
      });
      
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.position.copy(position);
      sprite.scale.set(4, 2, 1);
      
      return sprite;
    };
    
    // 添加近日点标签
    this.perihelionLabel = createTextSprite('近日点', new THREE.Vector3(
      perihelionPosition.x,
      perihelionPosition.y + 1.5,
      perihelionPosition.z
    ), '#ff0000');
    this.eclipticGroup.add(this.perihelionLabel);
    
    // 创建远日点标记
    const aphelionMaterial = new THREE.MeshBasicMaterial({ color: 0x00aaff });
    this.aphelionMarker = new THREE.Mesh(markerGeometry, aphelionMaterial);
    this.aphelionMarker.position.copy(aphelionPosition);
    this.eclipticGroup.add(this.aphelionMarker);
    
    // 添加远日点标签
    this.aphelionLabel = createTextSprite('远日点', new THREE.Vector3(
      aphelionPosition.x,
      aphelionPosition.y + 1.5,
      aphelionPosition.z
    ), '#00aaff');
    this.eclipticGroup.add(this.aphelionLabel);
    
    // 创建夏至点标记
    const summerSolsticeMaterial = new THREE.MeshBasicMaterial({ color: 0xff9900 });
    this.summerSolsticeMarker = new THREE.Mesh(markerGeometry, summerSolsticeMaterial);
    this.summerSolsticeMarker.position.copy(summerSolsticePosition);
    this.eclipticGroup.add(this.summerSolsticeMarker);
    
    // 添加夏至点标签
    this.summerSolsticeLabel = createTextSprite('夏至点', new THREE.Vector3(
      summerSolsticePosition.x,
      summerSolsticePosition.y + 1.5,
      summerSolsticePosition.z
    ), '#ff9900');
    this.eclipticGroup.add(this.summerSolsticeLabel);
    
    // 创建冬至点标记
    const winterSolsticeMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    this.winterSolsticeMarker = new THREE.Mesh(markerGeometry, winterSolsticeMaterial);
    this.winterSolsticeMarker.position.copy(winterSolsticePosition);
    this.eclipticGroup.add(this.winterSolsticeMarker);
    
    // 添加冬至点标签
    this.winterSolsticeLabel = createTextSprite('冬至点', new THREE.Vector3(
      winterSolsticePosition.x,
      winterSolsticePosition.y + 1.5,
      winterSolsticePosition.z
    ), '#00ffff');
    this.eclipticGroup.add(this.winterSolsticeLabel);
    
    // 创建地球
    const earthGeometry = new THREE.SphereGeometry(2, 64, 64);
    
    // 调整地球材质使亮暗对比更明显
    const earthMaterial = new THREE.MeshStandardMaterial({
      map: this.textures.earthDay,
      normalMap: this.textures.earthNormal,
      roughnessMap: this.textures.earthSpecular,
      roughness: 0.5,     // 降低粗糙度，增加反光
      metalness: 0.2,     // 增加金属感，增强高光
      normalScale: new THREE.Vector2(0.85, 0.85),
      envMapIntensity: 1.2 // 增强环境反射
    });
    
    this.earth = new THREE.Mesh(earthGeometry, earthMaterial);
    this.earth.name = 'earth';
    this.earthGroup.add(this.earth);
    
    // 添加地球赤道可视化
    const equatorRadius = 2.1; // 略大于地球半径，便于观察
    const equatorGeometry = new THREE.TorusGeometry(equatorRadius, 0.02, 16, 100);
    const equatorMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xff3333, 
      transparent: true, 
      opacity: 0.8,
      side: THREE.DoubleSide 
    });
    this.equator = new THREE.Mesh(equatorGeometry, equatorMaterial);
    // 旋转环使其水平放置，代表赤道
    this.equator.rotation.x = Math.PI / 2;
    this.earth.add(this.equator);
    
    // 添加地球自转轴可视化
    // 创建一个圆柱体作为自转轴
    const axisGeometry = new THREE.CylinderGeometry(0.03, 0.03, 5.5, 16);
    const axisMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x00ff00, 
      transparent: true, 
      opacity: 0.8 
    });
    this.earthAxis = new THREE.Mesh(axisGeometry, axisMaterial);
    
    // 旋转和位置调整，使轴穿过地球并与地球的倾斜角度一致
    this.earthAxis.position.set(0, 0, 0);
    // 添加到地球组，但与地球自身分开旋转
    this.earthGroup.add(this.earthAxis);
    
    // 添加北极和南极标记点
    const poleGeometry = new THREE.SphereGeometry(0.1, 16, 16);
    const northPoleMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const southPoleMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    
    this.northPole = new THREE.Mesh(poleGeometry, northPoleMaterial);
    this.southPole = new THREE.Mesh(poleGeometry, southPoleMaterial);
    
    // 位置调整，北极在轴的顶端，南极在轴的底端
    this.northPole.position.set(0, 2.75, 0);
    this.southPole.position.set(0, -2.75, 0);
    
    this.earthAxis.add(this.northPole);
    this.earthAxis.add(this.southPole);
    
    // 添加云层
    const cloudGeometry = new THREE.SphereGeometry(2.05, 64, 64);
    const cloudMaterial = new THREE.MeshStandardMaterial({
      map: this.textures.earthClouds,
      transparent: true,
      opacity: 0.8,
      alphaTest: 0.1
    });
    
    this.clouds = new THREE.Mesh(cloudGeometry, cloudMaterial);
    this.earthGroup.add(this.clouds);
    
    // 添加大气层
    const atmosphereGeometry = new THREE.SphereGeometry(2.15, 64, 64);
    const atmosphereMaterial = new THREE.ShaderMaterial({
      uniforms: {
        glowColor: { value: new THREE.Color(0x93cfef) },
        atmosphereIntensity: { value: 0.8 }, // 降低大气层初始强度，从1.5降到0.8
        sunPosition: { value: this.sunLight.position }
      },
      vertexShader: atmosphereVertexShader,
      fragmentShader: atmosphereFragmentShader,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false
    });
    
    this.atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    this.earthGroup.add(this.atmosphere);
    
    // 降低环境光强度，使暗面更暗
    this.ambientLight = new THREE.AmbientLight(0x444444, 0.2);
    this.scene.add(this.ambientLight);
    
    // 显著增强平行光强度，让亮面更亮
    this.sunDirectionalLight = new THREE.DirectionalLight(0xffffff, 4.0);
    this.sunDirectionalLight.position.set(0, 0, 0);
    this.scene.add(this.sunDirectionalLight);
    
    // 添加第二个定向光源，强化照亮阳光面
    this.secondDirectionalLight = new THREE.DirectionalLight(0xffffcc, 3.0);
    this.secondDirectionalLight.position.set(0, 0, 0);
    this.scene.add(this.secondDirectionalLight);
    
    // 减弱半球光强度，加强明暗对比
    this.hemisphereLight = new THREE.HemisphereLight(
      0xffffff, // 天空色
      0x111122, // 地面色更暗
      0.3 // 降低强度
    );
    this.scene.add(this.hemisphereLight);
    
    // 添加北京标记
    const createBeijingMarker = () => {
      // 北京坐标：北纬39.9度，东经116.3度
      const latitude = 39.9 * (Math.PI / 180); // 转换为弧度
      const longitude = 116.3 * (Math.PI / 180); // 转换为弧度
      
      // 将经纬度转换为球面坐标（r=地球半径）
      const radius = 2.05; // 略大于地球半径，使其位于表面上方
      const x = radius * Math.cos(latitude) * Math.cos(longitude);
      const y = radius * Math.sin(latitude);
      const z = radius * Math.cos(latitude) * Math.sin(longitude);
      
      // 创建一个醒目的标记 - 使用红色圆锥体
      const markerGeometry = new THREE.ConeGeometry(0.15, 0.3, 16);
      const markerMaterial = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        transparent: false,
        opacity: 1.0
      });
      
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.position.set(x, y, z);
      
      // 调整标记朝向，使其垂直于地球表面
      marker.lookAt(0, 0, 0);
      marker.rotateX(Math.PI); // 让圆锥尖端指向外部
      
      // 添加光环效果，让标记更显眼
      const ringGeometry = new THREE.TorusGeometry(0.08, 0.02, 16, 32);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        transparent: true,
        opacity: 0.8
      });
      
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.position.set(0, 0.1, 0); // 将环放在圆锥顶部附近
      ring.rotation.x = Math.PI / 2; // 使环水平放置
      
      marker.add(ring);
      
      return marker;
    };
    
    this.beijingMarker = createBeijingMarker();
    this.earth.add(this.beijingMarker);
  }
  
  createMoon() {
    // 创建月球组
    this.moonGroup = new THREE.Group();
    
    // 添加5.1度的倾角，这是月球轨道相对于黄道的倾角
    this.moonGroup.rotateX(5.1 * Math.PI / 180);
    
    this.earthGroup.add(this.moonGroup);
    
    // 创建月球
    const moonGeometry = new THREE.SphereGeometry(0.5, 32, 32);
    
    // 使用MeshStandardMaterial代替MeshPhongMaterial
    const moonMaterial = new THREE.MeshStandardMaterial({
      map: this.textures.moon,
      roughness: 0.8,
      metalness: 0.0,
      bumpMap: this.textures.moon,
      bumpScale: 0.05
    });
    
    this.moon = new THREE.Mesh(moonGeometry, moonMaterial);
    this.moon.name = 'moon';
    this.moon.position.set(5, 0, 0);
    this.moonGroup.add(this.moon);
    
    // 添加月球自转轴可视化
    // 创建一个细长的圆柱体作为自转轴
    const moonAxisGeometry = new THREE.CylinderGeometry(0.015, 0.015, 1.3, 16);
    const moonAxisMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x00ffff, 
      transparent: true, 
      opacity: 0.8 
    });
    this.moonAxis = new THREE.Mesh(moonAxisGeometry, moonAxisMaterial);
    
    // 添加到月球，保持自转轴与月球一起旋转
    this.moon.add(this.moonAxis);
    
    // 添加月球轨道可视化
    const moonOrbitGeometry = new THREE.TorusGeometry(5, 0.02, 16, 100);
    const moonOrbitMaterial = new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.3 });
    this.moonOrbit = new THREE.Mesh(moonOrbitGeometry, moonOrbitMaterial);
    // 旋转环使其水平放置
    this.moonOrbit.rotation.x = Math.PI / 2;
    this.moonGroup.add(this.moonOrbit);
    
    // 添加月球朝向标记 - 使用锥体形状更明显地表示方向
    const moonFaceGeometry = new THREE.ConeGeometry(0.12, 0.25, 16);
    const moonFaceMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xff00ff,
      transparent: false,
      opacity: 1.0
    });
    this.moonFaceMark = new THREE.Mesh(moonFaceGeometry, moonFaceMaterial);
    
    // 将标记初始位置设置在月球表面朝向地球的方向
    this.moonFaceMark.position.set(0, 0, 0.6);
    this.moon.add(this.moonFaceMark);
    
    // 添加连接线，从月球中心到朝向标记
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      this.moonFaceMark.position.clone()
    ]);
    
    const lineMaterial = new THREE.LineBasicMaterial({ 
      color: 0xff00ff, 
      linewidth: 3,  // 增加线宽
      transparent: false,
      opacity: 1.0
    });
    
    this.moonFaceLine = new THREE.Line(lineGeometry, lineMaterial);
    this.moon.add(this.moonFaceLine);
  }
  
  addEventListeners() {
    // 处理窗口大小变化
    window.addEventListener('resize', () => {
      this.sizes.width = window.innerWidth;
      this.sizes.height = window.innerHeight;
      
      this.camera.aspect = this.sizes.width / this.sizes.height;
      this.camera.updateProjectionMatrix();
      
      this.renderer.setSize(this.sizes.width, this.sizes.height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      
      this.composer.setSize(this.sizes.width, this.sizes.height);
    });
    
    // 鼠标移动
    window.addEventListener('mousemove', (event) => {
      this.mouse.x = (event.clientX / this.sizes.width) * 2 - 1;
      this.mouse.y = - (event.clientY / this.sizes.height) * 2 + 1;
    });
    
    // 鼠标点击
    window.addEventListener('click', () => {
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects([this.earth, this.moon, this.sun], false);
      
      if (intersects.length > 0) {
        const object = intersects[0].object;
        this.updateInfoPanel(object.name);
        
        // 动画到被点击的天体
        gsap.to(this.camera.position, {
          duration: 2,
          x: object.position.x * 1.5,
          y: object.position.y + 3,
          z: object.position.z + 8,
          onUpdate: () => {
            this.camera.lookAt(object.position);
          }
        });
      }
    });
  }
  
  updateInfoPanel(objectName) {
    let name = '';
    let info = '';
    
    switch(objectName) {
      case 'sun':
        name = '太阳';
        info = '直径: 1,392,684 km<br>质量: 1.989 × 10^30 kg<br>表面温度: 5,500°C';
        break;
      case 'earth':
        name = '地球';
        info = '直径: 12,742 km<br>质量: 5.972 × 10^24 kg<br>公转周期: 365.25天<br>自转周期: 24小时';
        break;
      case 'moon':
        name = '月球';
        info = '直径: 3,474 km<br>质量: 7.342 × 10^22 kg<br>公转周期: 27.3天<br>距地球: 384,400 km';
        break;
      default:
        return;
    }
    
    this.planetNameEl.textContent = name;
    this.planetInfoEl.innerHTML = info;
  }
  
  createGUI() {
    const gui = new GUI();
    
    // 速度控制
    const speedFolder = gui.addFolder('速度控制');
    
    // 创建速度控制对象
    this.speedControls = {
      earthRotationSpeed: 1, // 默认值设为1，而不是73.05
      pauseAnimation: false,
      resetSpeeds: () => {
        this.speedControls.earthRotationSpeed = 1;
        speedRotationControl.updateDisplay();
      }
    };
    
    // 添加地球自转速度控制滑块
    const speedRotationControl = speedFolder.add(this.speedControls, 'earthRotationSpeed', 0, 200, 0.1)
      .name('地球自转速度');
    
    // 添加暂停/继续动画的控制
    speedFolder.add(this.speedControls, 'pauseAnimation')
      .name('暂停动画')
      .onChange((value) => {
        if (value) {
          this.clock.stop();
        } else {
          this.clock.start();
        }
      });
    
    // 添加重置速度的按钮
    speedFolder.add(this.speedControls, 'resetSpeeds')
      .name('重置到默认速度');
    
    // 大气层控制
    const atmosphereFolder = gui.addFolder('大气层');
    atmosphereFolder.add(this.atmosphere.material.uniforms.atmosphereIntensity, 'value', 0, 1.5, 0.1).name('强度');
    
    // 轨道参数控制
    const orbitFolder = gui.addFolder('轨道参数');
    
    // 月球轨道倾角控制
    const moonOrbitControls = {
      moonOrbitInclination: 5.1
    };
    
    orbitFolder.add(moonOrbitControls, 'moonOrbitInclination', 0, 10, 0.1)
      .name('月球轨道倾角')
      .onChange((value) => {
        if (this.moonGroup) {
          // 重置月球组的旋转
          this.moonGroup.rotation.set(0, 0, 0);
          // 计算当前的公转角度
          const earthOrbitSpeed = 0.2;
          const moonOrbitSpeed = earthOrbitSpeed * (365.25 / 27.32);
          this.moonGroup.rotateY(this.elapsedTime * moonOrbitSpeed);
          // 重新应用当前的月球轨道倾角
          this.moonGroup.rotateX(value * Math.PI / 180);
        }
      });
    
    // 轨道可视化控制
    const orbitVisualsControls = {
      showEarthOrbit: true,
      showMoonOrbit: true,
      showEarthEquator: true,
      showEarthAxis: true,
      showMoonAxis: true,
      showMoonFace: true,
      showMoonFaceLine: true,
      showPerihelion: true,
      showAphelion: true,
      showSummerSolstice: true,
      showWinterSolstice: true,
      earthOrbitColor: '#4488aa',
      moonOrbitColor: '#888888',
      equatorColor: '#ff3333',
      axisColor: '#00ff00',
      moonAxisColor: '#00ffff',
      moonFaceColor: '#ff00ff'
    };
    
    orbitFolder.add(orbitVisualsControls, 'showEarthOrbit')
      .name('显示地球轨道')
      .onChange((value) => {
        if (this.earthOrbit) {
          this.earthOrbit.visible = value;
        }
      });
    
    orbitFolder.add(orbitVisualsControls, 'showMoonOrbit')
      .name('显示月球轨道')
      .onChange((value) => {
        if (this.moonOrbit) {
          this.moonOrbit.visible = value;
        }
      });
    
    orbitFolder.add(orbitVisualsControls, 'showEarthEquator')
      .name('显示地球赤道')
      .onChange((value) => {
        if (this.equator) {
          this.equator.visible = value;
        }
      });
    
    orbitFolder.add(orbitVisualsControls, 'showEarthAxis')
      .name('显示地球自转轴')
      .onChange((value) => {
        if (this.earthAxis) {
          this.earthAxis.visible = value;
          if (this.northPole) this.northPole.visible = value;
          if (this.southPole) this.southPole.visible = value;
        }
      });
    
    orbitFolder.add(orbitVisualsControls, 'showMoonAxis')
      .name('显示月球自转轴')
      .onChange((value) => {
        if (this.moonAxis) {
          this.moonAxis.visible = value;
        }
      });
    
    orbitFolder.add(orbitVisualsControls, 'showMoonFace')
      .name('显示月球朝向')
      .onChange((value) => {
        if (this.moonFaceMark) {
          this.moonFaceMark.visible = value;
        }
      });
    
    orbitFolder.add(orbitVisualsControls, 'showMoonFaceLine')
      .name('显示朝向连接线')
      .onChange((value) => {
        if (this.moonFaceLine) {
          this.moonFaceLine.visible = value;
        }
      });
    
    orbitFolder.add(orbitVisualsControls, 'showPerihelion')
      .name('显示近日点')
      .onChange((value) => {
        if (this.perihelionMarker) {
          this.perihelionMarker.visible = value;
          this.perihelionLabel.visible = value;
        }
      });
    
    orbitFolder.add(orbitVisualsControls, 'showAphelion')
      .name('显示远日点')
      .onChange((value) => {
        if (this.aphelionMarker) {
          this.aphelionMarker.visible = value;
          this.aphelionLabel.visible = value;
        }
      });
    
    orbitFolder.add(orbitVisualsControls, 'showSummerSolstice')
      .name('显示夏至点')
      .onChange((value) => {
        if (this.summerSolsticeMarker) {
          this.summerSolsticeMarker.visible = value;
          this.summerSolsticeLabel.visible = value;
        }
      });
    
    orbitFolder.add(orbitVisualsControls, 'showWinterSolstice')
      .name('显示冬至点')
      .onChange((value) => {
        if (this.winterSolsticeMarker) {
          this.winterSolsticeMarker.visible = value;
          this.winterSolsticeLabel.visible = value;
        }
      });
    
    orbitFolder.addColor(orbitVisualsControls, 'earthOrbitColor')
      .name('地球轨道颜色')
      .onChange((value) => {
        if (this.earthOrbit && this.earthOrbit.material) {
          this.earthOrbit.material.color.set(value);
        }
      });
    
    orbitFolder.addColor(orbitVisualsControls, 'moonOrbitColor')
      .name('月球轨道颜色')
      .onChange((value) => {
        if (this.moonOrbit && this.moonOrbit.material) {
          this.moonOrbit.material.color.set(value);
        }
      });
    
    orbitFolder.addColor(orbitVisualsControls, 'equatorColor')
      .name('赤道颜色')
      .onChange((value) => {
        if (this.equator && this.equator.material) {
          this.equator.material.color.set(value);
        }
      });
    
    orbitFolder.addColor(orbitVisualsControls, 'axisColor')
      .name('自转轴颜色')
      .onChange((value) => {
        if (this.earthAxis && this.earthAxis.material) {
          this.earthAxis.material.color.set(value);
        }
      });
    
    orbitFolder.addColor(orbitVisualsControls, 'moonAxisColor')
      .name('月球轴颜色')
      .onChange((value) => {
        if (this.moonAxis && this.moonAxis.material) {
          this.moonAxis.material.color.set(value);
        }
      });
    
    orbitFolder.addColor(orbitVisualsControls, 'moonFaceColor')
      .name('月球朝向颜色')
      .onChange((value) => {
        if (this.moonFaceMark && this.moonFaceMark.material) {
          this.moonFaceMark.material.color.set(value);
        }
        if (this.moonFaceLine && this.moonFaceLine.material) {
          this.moonFaceLine.material.color.set(value);
        }
      });
    
    // 添加信息面板
    const infoFolder = gui.addFolder('天体信息');
    
    // 添加动态比例信息（会根据速度变化而更新）
    this.timeInfoControls = {
      earthInfo: '地球: 1天自转, 365.25天公转',
      moonInfo: '月球: 27.32天同步自转和公转',
      speedRatio: `本模型中: 自转加快了${(this.speedControls.earthRotationSpeed / 0.2).toFixed(2)}倍`
    };
    
    // 使用disable: true的选项来创建只读文本
    const earthInfoUI = infoFolder.add(this.timeInfoControls, 'earthInfo').disable();
    const moonInfoUI = infoFolder.add(this.timeInfoControls, 'moonInfo').disable();
    this.speedRatioUI = infoFolder.add(this.timeInfoControls, 'speedRatio').disable();
    
    // 地理标记控制
    const markersFolder = gui.addFolder('地理标记');
    const markersControl = {
      showBeijingMarker: true
    };
    
    markersFolder.add(markersControl, 'showBeijingMarker')
      .name('显示北京标记')
      .onChange((value) => {
        if (this.beijingMarker) {
          this.beijingMarker.visible = value;
        }
      });
    
    // 默认展开GUI
    gui.open();
  }
  
  hideLoading() {
    gsap.to(this.loadingScreen, {
      opacity: 0,
      duration: 1,
      onComplete: () => {
        this.loadingScreen.style.display = 'none';
      }
    });
  }
  
  animate() {
    this.elapsedTime = this.clock.getElapsedTime();
    
    if (this.sun) {
      // 更新太阳自转 - 基于地球自转速度进行缩放
      const baseSunRotation = 0.05;
      const earthRotationRatio = this.speedControls ? (this.speedControls.earthRotationSpeed / 73.05) : 1;
      this.sun.rotation.y = this.elapsedTime * baseSunRotation * earthRotationRatio;
    }
    
    if (this.earth && this.clouds && this.earthGroup) {
      // 使用GUI中设置的地球自转速度
      const earthRotationSpeed = this.speedControls ? this.speedControls.earthRotationSpeed : 73.05;
      
      // 计算地球公转速度 - 从自转速度反推
      // 真实情况下，地球自转速度是公转速度的365.25倍
      const earthOrbitSpeed = earthRotationSpeed / 365.25;
      
      // 更新地球自转
      this.earth.rotation.y = this.elapsedTime * earthRotationSpeed;
      this.clouds.rotation.y = this.elapsedTime * (earthRotationSpeed * 0.9); // 云层略慢于地球自转
      
      // 计算椭圆轨道位置
      const angle = this.elapsedTime * earthOrbitSpeed;
      
      // 地球轨道的半长轴和离心率
      const earthOrbitRadius = 20;
      const earthOrbitEccentricity = 0.25;
      
      // 根据开普勒第二定律，计算椭圆轨道上的位置
      const r = (earthOrbitRadius * (1 - earthOrbitEccentricity * earthOrbitEccentricity)) / 
                (1 + earthOrbitEccentricity * Math.cos(angle));
      
      // 翻转x轴方向，与轨道创建时保持一致
      const earthX = -r * Math.cos(angle);
      const earthZ = r * Math.sin(angle);
      
      this.earthGroup.position.set(earthX, 0, earthZ);
      
      // 重置地球组的旋转
      this.earthGroup.rotation.set(0, 0, 0);
      
      // 添加地球自转轴倾斜（23.5度）
      this.earthGroup.rotateZ(23.5 * Math.PI / 180);
      
      // 让地球面向正确的方向
      this.earthGroup.rotateY(this.elapsedTime * earthOrbitSpeed);
      
      // 更新自转轴的朝向，使其始终保持与地球的倾斜角度一致
      if (this.earthAxis) {
        // 确保自转轴与地球自转轴方向保持一致
        this.earthAxis.rotation.set(0, 0, 0);
      }
      
      // 更新所有光源方向，使其始终从太阳位置照向地球
      const sunToEarth = new THREE.Vector3().subVectors(this.earthGroup.position, new THREE.Vector3(0, 0, 0)).normalize();
      
      // 更新主定向光
      if (this.sunDirectionalLight) {
        // 调整位置以从太阳方向照射
        this.sunDirectionalLight.position.copy(this.earthGroup.position);
        this.sunDirectionalLight.position.sub(sunToEarth.multiplyScalar(10));
        this.sunDirectionalLight.target = this.earthGroup;
      }
      
      // 更新第二定向光，从稍微不同角度照射以增强效果
      if (this.secondDirectionalLight) {
        const offsetAngle = Math.PI / 12; // 15度偏移
        const offsetVector = new THREE.Vector3(
          Math.sin(offsetAngle), 
          Math.cos(offsetAngle),
          0
        ).normalize();
        
        // 计算偏移位置
        const offsetPosition = new THREE.Vector3().copy(this.earthGroup.position);
        offsetPosition.sub(sunToEarth.clone().multiplyScalar(8).add(offsetVector.multiplyScalar(2)));
        
        this.secondDirectionalLight.position.copy(offsetPosition);
        this.secondDirectionalLight.target = this.earthGroup;
      }
    }
    
    if (this.moon && this.moonGroup) {
      // 计算地球公转速度 - 从自转速度反推
      const earthRotationSpeed = this.speedControls ? this.speedControls.earthRotationSpeed : 73.05;
      const earthOrbitSpeed = earthRotationSpeed / 365.25;
      
      // 月球公转周期为27.32天，地球公转周期为365.25天
      // 因此月球公转速度相对于地球公转速度为365.25/27.32 ≈ 13.37倍
      const moonOrbitSpeed = earthOrbitSpeed * (365.25 / 27.32);
      
      // 重置月球组的旋转
      this.moonGroup.rotation.set(0, 0, 0);
      // 应用月球公转的旋转角度
      this.moonGroup.rotateY(this.elapsedTime * moonOrbitSpeed);
      // 重新应用轨道倾角
      this.moonGroup.rotateX(5.1 * Math.PI / 180);
      
      // 月球已实现潮汐锁定，不需要独立的自转
      // 为了实现同步自转，需要计算到地球中心的向量
      const moonToEarth = new THREE.Vector3(0, 0, 0).sub(this.moon.position).normalize();
      
      // 重置月球的旋转
      this.moon.rotation.set(0, 0, 0);
      
      // 创建一个四元数，将月球的z轴对齐到指向地球的向量
      const quaternion = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1), // 月球的初始z轴方向
        moonToEarth // 目标方向：朝向地球
      );
      
      // 应用四元数旋转
      this.moon.quaternion.copy(quaternion);
      
      // 更新月球朝向标记的位置和方向
      if (this.moonFaceMark) {
        // 朝向标记在月球的z轴方向，面向地球
        this.moonFaceMark.position.set(0, 0, 0.6);
        // 让锥体尖端朝向地球
        this.moonFaceMark.rotation.set(0, Math.PI, 0);
      }
      
      // 更新连接线，从月球中心到朝向标记
      if (this.moonFaceLine) {
        // 移除旧的连接线
        this.moon.remove(this.moonFaceLine);
        
        // 创建新的连接线几何体
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, 0),
          this.moonFaceMark.position.clone()
        ]);
        
        const lineMaterial = new THREE.LineBasicMaterial({ 
          color: 0xff00ff, 
          linewidth: 3,
          transparent: false,
          opacity: 1.0
        });
        
        // 创建新的连接线并添加到月球
        this.moonFaceLine = new THREE.Line(lineGeometry, lineMaterial);
        this.moon.add(this.moonFaceLine);
      }
    }
    
    // 确保大气层的uniform值持续更新
    if (this.atmosphere && this.atmosphere.material.uniforms) {
      this.atmosphere.material.uniforms.sunPosition.value = new THREE.Vector3(0, 0, 0);
      this.atmosphere.material.uniforms.atmosphereIntensity.value = 0.8; // 确保大气强度值保持为较低值，从1.5降到0.8
    }
    
    // 更新速度比例信息
    if (this.speedControls && this.timeInfoControls && this.speedRatioUI) {
      const currentSpeedRatio = (this.speedControls.earthRotationSpeed / 0.2).toFixed(2);
      this.timeInfoControls.speedRatio = `本模型中: 自转加快了${currentSpeedRatio}倍`;
      this.speedRatioUI.updateDisplay();
    }
    
    // 更新控制器
    this.controls.update();
    
    // 渲染场景
    this.composer.render();
    
    // 请求下一帧
    window.requestAnimationFrame(this.animate.bind(this));
  }
}

// 初始化应用
const app = new SolarSystemApp(); 