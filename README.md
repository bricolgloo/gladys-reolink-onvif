# gladys-reolink-onvif

Intégration Gladys Assistant pour caméras Reolink via ONVIF.  
Fonctionne en local, sans cloud, compatible firmware v3.x (E1 Pro testé).

## Fonctionnalités

- 📸 Snapshots périodiques et à la demande
- 🚨 Détection de mouvement (ONVIF PullPoint events)
- 🎥 Flux RTSP exposé dans Gladys
- 🕹️ PTZ (8 directions + presets)
- 🔇 Audio mute/unmute

## Pourquoi cette intégration ?

L'intégration Reolink officielle pour Gladys cible l'API HTTP JSON propriétaire de Reolink.  
Depuis le firmware v3.x (2024/2025), cette API n'est plus exposée en local.  
Cette intégration utilise à la place le protocole **ONVIF** (standard ouvert), qui reste disponible sur le port 8000.

## Installation

1. Fork ce repo sur GitHub
2. Ajoute le topic GitHub `gladys-assistant-integration`
3. Configure les secrets GitHub (GHCR est automatique via `GITHUB_TOKEN`)
4. Lance **Actions → Release → Run workflow** → `patch`
5. L'image Docker est publiée sur `ghcr.io/<ton-username>/gladys-reolink-onvif`
6. Dans Gladys → Intégrations → Chercher "Reolink ONVIF" → Installer

## Développement local

```bash
npm install
GLADYS_HOST_API_URL="http://192.168.1.14:80" \
GLADYS_INTEGRATION_TOKEN="<token>" \
GLADYS_INTEGRATION_SELECTOR="reolink-onvif" \
LOG_LEVEL=debug \
npm start
```

## Structure

```
├── index.js                  # Bootstrap + wiring SDK
├── src/
│   ├── config.js             # Chargement config
│   ├── discovery.js          # Connexion ONVIF + découverte
│   ├── snapshots.js          # Loop de capture image
│   ├── events.js             # Poll ONVIF motion events
│   └── actions.js            # PTZ + audio
├── docs/
│   ├── fr.md                 # Doc utilisateur FR
│   └── en.md                 # Doc utilisateur EN
└── gladys-assistant-integration.json
```

## Licence

Apache-2.0
