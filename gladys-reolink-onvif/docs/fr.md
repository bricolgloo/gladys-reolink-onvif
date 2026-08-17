# Intégration Reolink ONVIF pour Gladys Assistant

Cette intégration connecte vos caméras Reolink à Gladys via le protocole **ONVIF** (port 8000 par défaut). Elle fonctionne entièrement en local, sans compte Reolink ni accès cloud.

## Compatibilité

Testé avec : **Reolink E1 Pro** (firmware v3.x)

Compatible en principe avec toutes les caméras Reolink exposant ONVIF, ainsi que d'autres marques supportant ONVIF Profile S/T.

## Prérequis

### Activer ONVIF sur votre caméra

1. Ouvrez l'application **Reolink** sur votre téléphone
2. Sélectionnez votre caméra → ⚙️ Paramètres
3. Allez dans **Avancé** → **Paramètres du serveur**
4. Vérifiez que **RTSP** et **ONVIF** sont activés (toggle bleu)
5. Notez le **port ONVIF** (par défaut : 8000)

### Créer un utilisateur dédié (recommandé)

Dans l'app Reolink → Paramètres → Gestion des utilisateurs, créez un utilisateur avec accès limité pour Gladys. Ou utilisez `admin` avec votre mot de passe habituel.

## Configuration

| Paramètre | Description | Défaut |
|-----------|-------------|--------|
| Identifiant | Nom d'utilisateur Reolink | `admin` |
| Mot de passe | Mot de passe Reolink | — |
| Port ONVIF | Port d'écoute ONVIF | `8000` |
| Adresses IP | IPs manuelles (optionnel) | auto-découverte |
| Intervalle snapshot | Fréquence de capture image | `60` s |
| Intervalle événements | Fréquence de poll mouvement | `5` s |

### Adresses IP manuelles

Si la découverte automatique ne fonctionne pas (réseau avec broadcast filtré), renseignez les IPs manuellement, séparées par des virgules :
```
192.168.1.75, 192.168.1.76
```

## Fonctionnalités

### ✅ Disponible
- **Image / snapshot** : capture périodique et à la demande depuis le tableau de bord
- **Détection de mouvement** : via ONVIF PullPoint events
- **Flux RTSP** : URL injectée dans les paramètres de l'appareil
- **PTZ** : déplacement (8 directions) et positions préréglées (si caméra motorisée)
- **Audio** : mute/unmute (si supporté par le firmware)

### ⚠️ Limitations connues
- L'audio mute via ONVIF est partiellement supporté par Reolink
- La découverte automatique peut ne pas fonctionner si votre routeur filtre le multicast/broadcast UDP
- Le firmware Reolink récent (v3.x) n'expose plus d'API HTTP JSON — c'est pour ça que cette intégration utilise ONVIF

## Dépannage

### Aucune caméra trouvée
1. Vérifiez que ONVIF est activé dans l'app Reolink
2. Confirmez l'IP et le port ONVIF (8000 par défaut)
3. Renseignez l'IP manuellement dans la configuration
4. Testez depuis votre serveur : `nmap -p 8000 192.168.1.75` (doit afficher `open`)

### Snapshot échoue
- Vérifiez que l'identifiant et le mot de passe sont corrects
- Certains firmwares Reolink nécessitent l'auth Basic sur le snapshot URI

### Pas de détection de mouvement
- Le PullPoint ONVIF peut ne pas être supporté sur votre modèle
- Vérifiez dans les journaux de l'intégration si le message "PullPoint not supported" apparaît
