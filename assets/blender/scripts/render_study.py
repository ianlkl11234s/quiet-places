"""Run one small study using Metal; fail instead of silently falling back to CPU."""
import bpy
scene = bpy.data.scenes['Leaflight_Study']
if bpy.context.window:
    bpy.context.window.scene = scene
prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type = 'METAL'
prefs.get_devices()
gpu = [d for d in prefs.devices if d.type == 'METAL']
if not gpu:
    raise RuntimeError('Metal GPU not available; no CPU fallback permitted')
for device in prefs.devices:
    device.use = device.type == 'METAL'
scene.cycles.device = 'GPU'
print('STUDY_DEVICE', [d.name for d in gpu], flush=True)
# Normalise the standalone scene library into an ordinary reopenable .blend.
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            area.spaces.active.region_3d.view_perspective = 'CAMERA'
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
bpy.ops.render.render(write_still=True, scene=scene.name)
