# Reolink ONVIF Integration for Gladys Assistant

This integration connects your Reolink cameras to Gladys via the **ONVIF** protocol (port 8000 by default). It works entirely locally — no Reolink account or cloud access required.

## Compatibility

Tested with: **Reolink E1 Pro** (firmware v3.x)

Should work with any Reolink camera exposing ONVIF, and other brands supporting ONVIF Profile S/T.

## Requirements

### Enable ONVIF on your camera

1. Open the **Reolink** app on your phone
2. Select your camera → ⚙️ Settings
3. Go to **Advanced** → **Server settings**
4. Make sure **RTSP** and **ONVIF** are enabled (blue toggle)
5. Note the **ONVIF port** (default: 8000)

## Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| Username | Reolink username | `admin` |
| Password | Reolink password | — |
| ONVIF port | ONVIF listening port | `8000` |
| Camera IPs | Manual IPs (optional) | auto-discovery |
| Snapshot interval | Image capture frequency | `60` s |
| Motion poll interval | Motion event poll frequency | `5` s |

## Features

### ✅ Supported
- **Snapshots**: periodic and on-demand from the dashboard
- **Motion detection**: via ONVIF PullPoint events
- **RTSP stream URL**: injected into device parameters
- **PTZ**: 8-direction move + presets (motorized cameras)
- **Audio mute/unmute** (firmware-dependent)

### ⚠️ Known limitations
- Audio mute via ONVIF is only partially supported by Reolink
- Auto-discovery may not work if your router filters UDP multicast/broadcast
- Recent Reolink firmware (v3.x) no longer exposes an HTTP JSON API — that's why this integration uses ONVIF instead

## Troubleshooting

### No cameras found
1. Check ONVIF is enabled in the Reolink app
2. Confirm IP and ONVIF port (default 8000)
3. Enter the IP manually in the config
4. Test from your server: `nmap -p 8000 192.168.1.75` (must show `open`)

### Snapshot fails
- Check username and password
- Some Reolink firmware requires Basic auth on the snapshot URI

### No motion detection
- PullPoint ONVIF may not be supported on your model
- Check integration logs for "PullPoint not supported"
