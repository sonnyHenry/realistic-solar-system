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