'use strict';

function loadConfig(raw) {
  return {
    user: raw.camera_user || 'admin',
    password: raw.camera_password || '',
    onvifPort: parseInt(raw.onvif_port || '8000', 10),
    cameraIps: (raw.camera_ips || '')
      .split(',').map((s) => s.trim()).filter(Boolean),
    snapshotInterval: parseInt(raw.snapshot_interval || '60', 10) * 1000,
    motionPollInterval: parseInt(raw.motion_poll_interval || '5', 10) * 1000,
  };
}

module.exports = { loadConfig };