'use strict';

const { promisify } = require('util');
const { DEVICE_FEATURE_TYPES } = require('@gladysassistant/integration-sdk');

// PTZ direction map (value 0-7 → pan/tilt vector)
const PTZ_DIRECTIONS = {
  0: { x: 0, y: 1 },    // Up
  1: { x: 0, y: -1 },   // Down
  2: { x: -1, y: 0 },   // Left
  3: { x: 1, y: 0 },    // Right
  4: { x: 1, y: 1 },    // Up-Right
  5: { x: -1, y: 1 },   // Up-Left
  6: { x: 1, y: -1 },   // Down-Right
  7: { x: -1, y: -1 },  // Down-Left
};

const PTZ_SPEED = 0.5;
const PTZ_MOVE_DURATION_MS = 500;

/**
 * Handle setValue calls from Gladys (PTZ move, preset, audio mute).
 */
async function handleSetValue(state, gladys, device, feature, value, logger) {
  // Find camera by device external_id
  const cam = Object.values(state.cameras).find(
    (c) => gladys.externalId(c.externalId) === device.external_id,
  );

  if (!cam) {
    logger.warn(`setValue: camera not found for device ${device.external_id}`);
    return;
  }

  const onvifCam = cam.onvifCam;

  // Determine feature type from external_id suffix
  const extId = feature.external_id;

  if (extId.endsWith(':ptz:move')) {
    await handlePTZMove(onvifCam, cam, value, logger);
  } else if (extId.endsWith(':ptz:preset')) {
    await handlePTZPreset(onvifCam, cam, value, logger);
  } else if (extId.endsWith(':audio:mute')) {
    await handleAudioMute(onvifCam, cam, value, logger);
  } else {
    logger.warn(`setValue: unknown feature ${extId}`);
  }
}

async function handlePTZMove(onvifCam, cam, directionValue, logger) {
  if (!cam.hasPTZ) {
    logger.warn(`PTZ not supported on ${cam.name}`);
    return;
  }

  const dir = PTZ_DIRECTIONS[directionValue];
  if (!dir) {
    logger.warn(`Invalid PTZ direction value: ${directionValue}`);
    return;
  }

  try {
    const continuousMove = promisify(onvifCam.continuousMove.bind(onvifCam));
    const stop = promisify(onvifCam.stop.bind(onvifCam));

    await continuousMove({
      velocity: {
        x: dir.x * PTZ_SPEED,
        y: dir.y * PTZ_SPEED,
        zoom: 0,
      },
    });

    // Stop after a short duration
    await new Promise((r) => setTimeout(r, PTZ_MOVE_DURATION_MS));
    await stop({ panTilt: true, zoom: false });

    logger.debug(`PTZ move on ${cam.name}: direction ${directionValue}`);
  } catch (err) {
    logger.error(`PTZ move failed on ${cam.name}: ${err.message}`);
  }
}

async function handlePTZPreset(onvifCam, cam, presetToken, logger) {
  if (!cam.hasPTZ) {
    logger.warn(`PTZ not supported on ${cam.name}`);
    return;
  }

  try {
    const gotoPreset = promisify(onvifCam.gotoPreset.bind(onvifCam));
    await gotoPreset({ presetToken: String(presetToken) });
    logger.debug(`PTZ goto preset ${presetToken} on ${cam.name}`);
  } catch (err) {
    logger.error(`PTZ goto preset failed on ${cam.name}: ${err.message}`);
  }
}

async function handleAudioMute(onvifCam, cam, muteValue, logger) {
  // ONVIF audio mute via setAudioOutputConfiguration is not universally supported.
  // Reolink's ONVIF implementation is partial — log and warn.
  logger.info(`Audio mute set to ${muteValue} on ${cam.name} (if supported by camera firmware)`);

  try {
    // Attempt to set audio output configuration mute
    const getAudioOutputs = promisify(onvifCam.getAudioOutputs.bind(onvifCam));
    const outputs = await getAudioOutputs();

    if (!outputs || outputs.length === 0) {
      logger.warn(`No audio outputs found on ${cam.name}`);
      return;
    }

    const getAudioOutputConf = promisify(onvifCam.getAudioOutputConfiguration.bind(onvifCam));
    const conf = await getAudioOutputConf({ outputToken: outputs[0].$.token });

    const setAudioOutputConf = promisify(onvifCam.setAudioOutputConfiguration.bind(onvifCam));
    await setAudioOutputConf({
      configuration: {
        ...conf,
        mute: muteValue === 1,
      },
      forcePersistence: true,
    });

    logger.debug(`Audio mute applied on ${cam.name}`);
  } catch (err) {
    logger.warn(`Audio mute not supported on ${cam.name}: ${err.message}`);
  }
}

module.exports = { handleSetValue };
