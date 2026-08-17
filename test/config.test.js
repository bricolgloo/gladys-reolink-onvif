'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { loadConfig } = require('../src/config');

describe('loadConfig', () => {
  it('applies defaults when config is empty', () => {
    const cfg = loadConfig({});
    assert.equal(cfg.user, 'admin');
    assert.equal(cfg.onvifPort, 8000);
    assert.deepEqual(cfg.cameraIps, []);
    assert.equal(cfg.snapshotInterval, 60000);
    assert.equal(cfg.motionPollInterval, 5000);
  });

  it('parses comma-separated IPs', () => {
    const cfg = loadConfig({ CAMERA_IPS: '192.168.1.75, 192.168.1.76' });
    assert.deepEqual(cfg.cameraIps, ['192.168.1.75', '192.168.1.76']);
  });

  it('overrides defaults from config', () => {
    const cfg = loadConfig({
      CAMERA_USER: 'gladys',
      CAMERA_PASSWORD: 'secret',
      ONVIF_PORT: '9000',
      SNAPSHOT_INTERVAL: '30',
      MOTION_POLL_INTERVAL: '10',
    });
    assert.equal(cfg.user, 'gladys');
    assert.equal(cfg.password, 'secret');
    assert.equal(cfg.onvifPort, 9000);
    assert.equal(cfg.snapshotInterval, 30000);
    assert.equal(cfg.motionPollInterval, 10000);
  });
});
