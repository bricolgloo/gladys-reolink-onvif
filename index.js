'use strict';

const { GladysIntegration, createLogger, DEVICE_FEATURE_CATEGORIES, DEVICE_FEATURE_TYPES } = require('@gladysassistant/integration-sdk');
const { loadConfig } = require('./src/config');
const { discoverCameras, connectCameras } = require('./src/discovery');
const { startMotionPolling, stopMotionPolling } = require('./src/events');
const { startSnapshotLoop, stopSnapshotLoop } = require('./src/snapshots');
const { handleSetValue } = require('./src/actions');

const logger = createLogger({ name: 'reolink-onvif' });

// State shared across modules
const state = {
  cameras: {}, // { externalId: { device, cam, onvifCam } }
  config: null,
  motionTimers: {},
  snapshotTimers: {},
};

async function init(gladys) {
  state.config = loadConfig(gladys.getConfig());
  logger.info('Config received: ' + JSON.stringify(gladys.getConfig()));
  logger.info('Starting Reolink ONVIF integration...');

  try {
    await gladys.setConnectionStatus(false, { en: 'Connecting to cameras...', fr: 'Connexion aux caméras...' });

    // Connect cameras (discovery or manual IPs)
    const cameras = await connectCameras(state.config, logger);

    if (cameras.length === 0) {
      await gladys.setConnectionStatus(false, { en: 'No cameras found. Check IP and credentials.', fr: 'Aucune caméra trouvée. Vérifiez IP et identifiants.' });
      return;
    }

    // Register devices in Gladys
    for (const cam of cameras) {
      const devices = buildDevices(gladys, cam);
      for (const device of devices) {
        await gladys.createDevice(device);
        logger.info(`Registered camera: ${device.name}`);
      }
      state.cameras[cam.externalId] = cam;
    }

    await gladys.setConnectionStatus(true);
    logger.info(`Connected ${cameras.length} camera(s).`);

    // Start polling loops
    startSnapshotLoop(gladys, state, logger);
    startMotionPolling(gladys, state, logger);
  } catch (err) {
    logger.error('Initialization error:', err.message);
    await gladys.setConnectionStatus(false, { en: err.message, fr: err.message });
  }
}

function buildDevices(gladys, cam) {
  const features = [
    // Motion sensor
    {
      name: 'Motion',
      external_id: gladys.externalId(`${cam.externalId}:motion`),
      category: DEVICE_FEATURE_CATEGORIES.MOTION_SENSOR,
      type: DEVICE_FEATURE_TYPES.MOTION_SENSOR.BINARY,
      read_only: true,
      keep_history: true,
      has_feedback: true,
      min: 0,
      max: 1,
    },
    // Camera image
    {
      name: 'Image',
      external_id: gladys.externalId(`${cam.externalId}:image`),
      category: DEVICE_FEATURE_CATEGORIES.CAMERA,
      type: DEVICE_FEATURE_TYPES.CAMERA.IMAGE,
      read_only: true,
      keep_history: false,
      has_feedback: false,
      min: 0,
      max: 0,
    },
  ];

  // Add PTZ features if supported
  if (cam.hasPTZ) {
    features.push({
      name: 'PTZ Move',
      external_id: gladys.externalId(`${cam.externalId}:ptz:move`),
      category: DEVICE_FEATURE_CATEGORIES.CAMERA,
      type: DEVICE_FEATURE_TYPES.CAMERA.MOVE,
      read_only: false,
      keep_history: false,
      has_feedback: false,
      min: 0,
      max: 8, // 8 directions
    });
    features.push({
      name: 'PTZ Preset',
      external_id: gladys.externalId(`${cam.externalId}:ptz:preset`),
      category: DEVICE_FEATURE_CATEGORIES.CAMERA,
      type: DEVICE_FEATURE_TYPES.CAMERA.PRESET,
      read_only: false,
      keep_history: false,
      has_feedback: false,
      min: 0,
      max: 255,
    });
  }

  // Add audio mute feature if supported
  if (cam.hasAudio) {
    features.push({
      name: 'Audio',
      external_id: gladys.externalId(`${cam.externalId}:audio:mute`),
      category: DEVICE_FEATURE_CATEGORIES.MICROPHONE,
      type: DEVICE_FEATURE_TYPES.MICROPHONE.MUTE,
      read_only: false,
      keep_history: false,
      has_feedback: false,
      min: 0,
      max: 1,
    });
  }

  return [
    {
      name: cam.name,
      external_id: gladys.externalId(cam.externalId),
      selector: cam.externalId,
      features,
      params: [
        { name: 'ip', value: cam.ip },
        { name: 'onvif_port', value: String(cam.onvifPort) },
        { name: 'rtsp_url', value: cam.rtspUrl },
      ],
    },
  ];
}

async function main() {
  const gladys = new GladysIntegration({
    selector: 'reolink-onvif',
    logger,
  });

  gladys.handleShutdown(async () => {
    logger.info('Shutting down...');
    stopSnapshotLoop(state);
    stopMotionPolling(state);
  });

  // Handle on-demand image capture
  gladys.onGetImage(async (externalId) => {
    const cam = Object.values(state.cameras).find(
      (c) => gladys.externalId(`${c.externalId}:image`) === externalId,
    );
    if (!cam) throw new Error(`Camera not found: ${externalId}`);
    return cam.getSnapshot();
  });

  // Handle setValue (PTZ, audio, etc.)
  gladys.onSetValue(async (device, feature, value) => {
    await handleSetValue(state, gladys, device, feature, value, logger);
  });

  // Handle action buttons from config UI
  gladys.onAction('discover_cameras', async () => {
    await init(gladys);
    return {
      en: 'Discovery complete.',
      fr: 'Découverte terminée.',
    };
  });

  gladys.onAction('test_connection', async () => {
    const results = [];
    for (const cam of Object.values(state.cameras)) {
      try {
        await cam.onvifCam.activate();
        results.push(`✅ ${cam.name} (${cam.ip})`);
      } catch (e) {
        results.push(`❌ ${cam.name} (${cam.ip}): ${e.message}`);
      }
    }
    const msg = results.join('\n') || 'No cameras configured.';
    return { en: msg, fr: msg };
  });

  await gladys.connect();
  await init(gladys);
}

main().catch((err) => {
  logger.error('Fatal error:', err);
  process.exit(1);
});