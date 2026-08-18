'use strict';

const { Cam } = require('onvif');
const { promisify } = require('util');
const { execFile } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

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

          const hasPTZ = Boolean(cam.capabilities && cam.capabilities.PTZ);
          const hasAudio = profiles.some((p) => p.audioEncoderConfiguration);

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

            async getSnapshot() {
              const rtspUri = `rtsp://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${ip}:554//h264Preview_01_main`;
              const tmpFile = path.join(os.tmpdir(), `snap_${Date.now()}.jpg`);
              logger.info(`Capturing snapshot via ffmpeg: ${tmpFile}`);

              await new Promise((res, rej) => {
execFile('ffmpeg', [
  '-rtsp_transport', 'tcp',
  '-i', rtspUri,
  '-frames:v', '1',
  '-q:v', '2',
  '-vf', 'scale=640:-1',
  '-update', '1',
  '-y', tmpFile,
], { timeout: 15000 }, (err) => {
                  if (err) return rej(new Error(`ffmpeg failed: ${err.message}`));
                  res();
                });
              });

              const buffer = fs.readFileSync(tmpFile);
              fs.unlinkSync(tmpFile);
              return `image/jpeg;base64,${buffer.toString('base64')}`;
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