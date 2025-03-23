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