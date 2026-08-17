'use strict';

/**
 * Load and normalize configuration from Gladys config object.
 */
function loadConfig(raw) {
  return {
    user: raw.CAMERA_USER || 'admin',
    password: raw.CAMERA_PASSWORD || '',
    onvifPort: parseInt(raw.ONVIF_PORT || '8000', 10),
    cameraIps: raw.CAMERA_IPS
      ? raw.CAMERA_IPS.split(',').map((s) => s.trim()).filter(Boolean)
      : [],
    snapshotInterval: parseInt(raw.SNAPSHOT_INTERVAL || '60', 10) * 1000,
    motionPollInterval: parseInt(raw.MOTION_POLL_INTERVAL || '5', 10) * 1000,
  };
}

module.exports = { loadConfig };
