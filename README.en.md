# Realistic 3D Solar System Model

A high-precision solar system simulation based on Three.js, featuring physically accurate planetary motion and lighting effects.

## Features

- **Realistic Visual Effects**: Using high-definition NASA textures with clear Earth surface details
- **Physical Accuracy**:
  - Elliptical orbits following Kepler's laws
  - Correct perihelion and aphelion positions
  - Accurate summer and winter solstice markers
  - Earth's 23.5° axial tilt
- **Atmospheric Scattering**: Rayleigh scattering algorithm simulating real atmosphere
- **Cloud Cover**: Semi-transparent cloud layer rotating with Earth
- **Seasonal Changes**: Correct seasonal transitions through axial tilt
- **Rich Interactions**: Adjustable viewpoints, zoom, and simulation speed
- **Detailed GUI Interface**: Controls for display parameters and simulation speed

## Technology Stack

- **Three.js**: Powerful WebGL 3D library
- **GLSL Shaders**: Custom atmospheric scattering effects
- **Vite**: Modern frontend build tool
- **GSAP**: Smooth animation effects
- **Lil-GUI**: Intuitive debug interface

## Installation and Running

```bash
# Clone repository
git clone https://github.com/sonnyHenry/realistic-solar-system.git

# Enter project directory
cd realistic-solar-system

# Install dependencies
npm install

# Run in development mode
npm run dev
```

## User Guide

### Mouse Controls

- **Left-click and drag**: Rotate the camera view around the scene
- **Right-click and drag**: Pan the scene
- **Mouse wheel**: Zoom in and out of the scene
- **Double-click**: Reset the camera view to default position
- **Click on celestial bodies**: View information about the Sun, Earth, or Moon and automatically navigate camera to that object

### Keyboard Controls

- **Arrow keys**: Alternative way to rotate the camera view
  - **Up/Down arrows**: Rotate camera up and down
  - **Left/Right arrows**: Rotate camera left and right
- **+/- keys**: Alternative way to zoom in and out
- **Space bar**: Pause/resume the animation (alternative to GUI control)
- **R key**: Reset camera to default view (same as double-click)

### GUI Panel Controls

The interactive GUI panel provides extensive control over the simulation:

#### Speed Controls
- **Earth Rotation Speed**: Adjust the rotation speed of Earth
- **Pause Animation**: Pause or resume the entire simulation
- **Reset to Default Speed**: Return to the default rotation speed

#### Atmosphere
- **Intensity**: Adjust the intensity of Earth's atmospheric effect

#### Orbit Parameters
- **Moon Orbit Inclination**: Adjust the inclination angle of the Moon's orbit
- **Show Earth Orbit**: Toggle visibility of Earth's orbit
- **Show Moon Orbit**: Toggle visibility of the Moon's orbit
- **Show Earth Equator**: Toggle visibility of Earth's equator
- **Show Earth Axis**: Toggle visibility of Earth's rotation axis
- **Show Moon Axis**: Toggle visibility of the Moon's rotation axis
- **Show Moon Face**: Toggle visibility of the Moon's facing marker
- **Show Facing Connection Line**: Toggle visibility of the line showing Moon's Earth-facing side
- **Show Perihelion**: Toggle visibility of the perihelion marker
- **Show Aphelion**: Toggle visibility of the aphelion marker
- **Show Summer Solstice**: Toggle visibility of the summer solstice marker
- **Show Winter Solstice**: Toggle visibility of the winter solstice marker
- **Earth Orbit Color**: Change the color of Earth's orbit
- **Moon Orbit Color**: Change the color of the Moon's orbit
- **Equator Color**: Change the color of Earth's equator
- **Axis Color**: Change the color of Earth's rotation axis
- **Moon Axis Color**: Change the color of the Moon's rotation axis
- **Moon Face Color**: Change the color of the Moon's facing marker

#### Geographic Markers
- **Show Beijing Marker**: Toggle visibility of the Beijing location marker

## Key Features Showcase

### Elliptical Orbit and Seasonal Changes

This model accurately simulates Earth's elliptical orbit and axial tilt, creating correct seasonal characteristics in the northern hemisphere during perihelion (winter) and aphelion (summer).

### Atmospheric Scattering Effect

Using physically accurate Rayleigh scattering algorithm to simulate atmospheric scattering of sunlight, creating orange-red light during sunrise/sunset and blue sky effect.

### Moon Tidal Locking

The Moon implements accurate tidal locking, always showing the same face toward Earth while maintaining the correct orbital inclination.

## License

MIT

## Acknowledgements

- NASA for planetary textures
- Three.js community for technical support
- Kepler and Newton's celestial physics theories
