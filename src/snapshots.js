'use strict';

/**
 * Periodically capture snapshots from all cameras and push to Gladys.
 */
function startSnapshotLoop(gladys, state, logger) {
  stopSnapshotLoop(state);

  const interval = state.config.snapshotInterval;
  logger.info(`Starting snapshot loop every ${interval / 1000}s`);

  // Take one immediately, then at interval
  captureAll(gladys, state, logger);

  state.snapshotTimer = setInterval(() => {
    captureAll(gladys, state, logger);
  }, interval);
}

async function captureAll(gladys, state, logger) {
  for (const cam of Object.values(state.cameras)) {
    try {
      const deviceExternalId = gladys.externalId(cam.externalId);
      logger.info(`Publishing image to feature: ${featureExternalId}`);  // ← ajoute ça
      const image = await cam.getSnapshot();
      await gladys.publishCameraImage(deviceExternalId, image);
    } catch (err) {
      logger.warn(`Snapshot failed for ${cam.name}: ${err.message}`);
    }
  }
}

function stopSnapshotLoop(state) {
  if (state.snapshotTimer) {
    clearInterval(state.snapshotTimer);
    state.snapshotTimer = null;
  }
}

module.exports = { startSnapshotLoop, stopSnapshotLoop };
