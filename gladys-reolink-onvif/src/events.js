'use strict';

const { promisify } = require('util');

/**
 * Poll ONVIF PullPoint events for motion detection on all cameras.
 * Falls back gracefully if the camera does not support events.
 */
async function startMotionPolling(gladys, state, logger) {
  stopMotionPolling(state);

  for (const cam of Object.values(state.cameras)) {
    await startCameraMotionPolling(gladys, state, cam, logger);
  }
}

async function startCameraMotionPolling(gladys, state, cam, logger) {
  const onvifCam = cam.onvifCam;

  // Try to create a PullPoint subscription
  try {
    const createSub = promisify(onvifCam.createPullPointSubscription.bind(onvifCam));
    await createSub();
    logger.info(`ONVIF PullPoint subscription created for ${cam.name}`);
  } catch (err) {
    logger.warn(`PullPoint not supported on ${cam.name}: ${err.message}. Motion detection disabled.`);
    return;
  }

  const interval = state.config.motionPollInterval;
  const featureExternalId = gladys.externalId(`${cam.externalId}:motion`);

  async function poll() {
    try {
      const pullMessages = promisify(onvifCam.pullMessages.bind(onvifCam));
      const result = await pullMessages({ MessageLimit: 10 });
      const messages = result.notificationMessage || [];

      for (const msg of messages) {
        const topic = msg.topic && msg.topic._ ? msg.topic._ : '';
        const isMotion =
          topic.includes('MotionAlarm') ||
          topic.includes('Motion') ||
          topic.includes('RuleEngine/CellMotionDetector') ||
          topic.includes('VideoSource/MotionAlarm');

        if (isMotion) {
          const data = msg.message && msg.message.message && msg.message.message.data;
          let motionValue = 0;

          if (data && data.simpleItem) {
            const items = Array.isArray(data.simpleItem) ? data.simpleItem : [data.simpleItem];
            for (const item of items) {
              if (item.$ && (item.$.Name === 'IsMotion' || item.$.Name === 'State')) {
                motionValue = item.$.Value === 'true' || item.$.Value === '1' ? 1 : 0;
              }
            }
          }

          await gladys.publishState(featureExternalId, motionValue);
          logger.debug(`Motion event on ${cam.name}: ${motionValue}`);
        }
      }
    } catch (err) {
      logger.warn(`Motion poll error on ${cam.name}: ${err.message}`);
    }
  }

  // Poll immediately then at interval
  poll();
  state.motionTimers[cam.externalId] = setInterval(poll, interval);
}

function stopMotionPolling(state) {
  for (const timer of Object.values(state.motionTimers)) {
    clearInterval(timer);
  }
  state.motionTimers = {};
}

module.exports = { startMotionPolling, stopMotionPolling };
