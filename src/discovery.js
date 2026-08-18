'use strict';

const { Cam } = require('onvif');
const { promisify } = require('util');
const DigestFetch = require('digest-fetch');

/**
 * Connect to cameras from manual IPs or via ONVIF WS-Discovery.
 * Returns an array of camera objects ready for use.
 */
async function connectCameras(config, logger) {
  let ips = config.cameraIps;

  if (ips.length === 0) {
    logger.info('No IPs configured, attempting ONVIF WS-Discovery...');
    ips = await discoverCameras(logger);
  }

  if (ips.length === 0) {
    logger.warn('No cameras found via discovery and no IPs configured.');
    return [];
  }

  const results = [];
  for (const ip of ips) {
    try {
      const cam = await connectCamera(ip, config.onvifPort, config.user, config.password, logger);
      results.push(cam);
    } catch (err) {
      logger.warn(`Failed to connect to camera at ${ip}:${config.onvifPort} — ${err.message}`);
    }
  }

  return results;
}

/**
 * WS-Discovery: returns list of IP addresses of ONVIF cameras on the network.
 */
function discoverCameras(logger) {
  return new Promise((resolve) => {
    const { Discovery } = require('onvif');
    const found = [];

    const timer = setTimeout(() => {
      logger.info(`Discovery finished: found ${found.length} camera(s).`);
      resolve(found);
    }, 5000);

    Discovery.on('device', (cam, rinfo) => {
      logger.info(`Discovered camera at ${rinfo.address}`);
      found.push(rinfo.address);
    });

    try {
      Discovery.probe();
    } catch (err) {
      logger.warn('Discovery probe error:', err.message);
      clearTimeout(timer);
      resolve(found);
    }
  });
}

/**
 * Connect to a single camera via ONVIF and return a camera descriptor.
 */
function connectCamera(ip, port, user, password, logger) {
  return new Promise((resolve, reject) => {
    const cam = new Cam(
      {
        hostname: ip,
        port,
        username: user,
        password,
        timeout: 10000,
      },
      async (err) => {
        if (err) {
          return reject(new Error(`ONVIF connect failed: ${err.message || err}`));
        }

        try {
          const info = await promisify(cam.getDeviceInformation.bind(cam))();
          const profiles = await promisify(cam.getProfiles.bind(cam))();

          // Detect capabilities
          const hasPTZ = Boolean(cam.capabilities && cam.capabilities.PTZ);
          const hasAudio = profiles.some((p) => p.audioEncoderConfiguration);

          // Get RTSP stream URL
          let rtspUrl = '';
          try {
            const streamUri = await promisify(cam.getStreamUri.bind(cam))({
              protocol: 'RTSP',
              profileToken: profiles[0].$.token,
            });
            rtspUrl = streamUri.uri.replace(
              'rtsp://',
              `rtsp://${encodeURIComponent(user)}:${encodeURIComponent(password)}@`,
            );
          } catch (e) {
            logger.warn(`Could not get RTSP URI for ${ip}: ${e.message}`);
          }

          // Unique external ID based on MAC or serial
          const serial = info.serialNumber || info.hardwareId || ip.replace(/\./g, '_');
          const externalId = serial;
          const name = info.model ? `${info.manufacturer} ${info.model}` : `Camera ${ip}`;

          logger.info(`Connected: ${name} at ${ip} (PTZ: ${hasPTZ}, Audio: ${hasAudio})`);

          resolve({
            ip,
            onvifPort: port,
            externalId,
            name,
            hasPTZ,
            hasAudio,
            rtspUrl,
            onvifCam: cam,
            info,

            // Convenience method: capture a JPEG snapshot
            async getSnapshot() {
              const snapshotUri = await promisify(cam.getSnapshotUri.bind(cam))({
                profileToken: profiles[0].$.token,
              });

              // Log l'URI brute pour debug
              logger.debug(`Raw snapshot URI from ONVIF: ${snapshotUri.uri}`);

              // Corriger l'host si la caméra retourne localhost/127.0.0.1
              const urlObj = new URL(snapshotUri.uri);
              if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
                logger.warn(`Snapshot URI had wrong host (${urlObj.hostname}), correcting to ${ip}`);
                urlObj.hostname = ip;
              }
              const fixedUri = urlObj.toString();
              logger.debug(`Fetching snapshot from: ${fixedUri}`);

              // Tentative Basic Auth
              let response = await fetch(fixedUri, {
                headers: {
                  Authorization: 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64'),
                },
                signal: AbortSignal.timeout(10000),
              });

              // Fallback Digest Auth si 401
              if (response.status === 401) {
                logger.debug('Basic auth rejected (401), retrying with Digest Auth...');
                const digestClient = new DigestFetch(user, password);
                response = await digestClient.fetch(fixedUri, {
                  signal: AbortSignal.timeout(10000),
                });
              }

              if (!response.ok) throw new Error(`Snapshot fetch failed: ${response.status}`);
              const buffer = await response.arrayBuffer();
              const b64 = Buffer.from(buffer).toString('base64');
              return `image/jpeg;base64,${b64}`;
            },
          });
        } catch (innerErr) {
          reject(new Error(`Camera init error at ${ip}: ${innerErr.message}`));
        }
      },
    );
  });
}

module.exports = { connectCameras, discoverCameras, connectCamera };