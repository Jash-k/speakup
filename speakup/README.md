# SpeakUp — mobile-first English practice

A lightweight, installable web app for practising spoken English with friendly role-play conversations, per-turn corrections and an optional pronunciation-guidance toggle. It uses browser speech features where available and sends AI requests to Google Gemini through a small Node.js proxy.

## Included

- Free talk, job interview, office, daily-life and small-talk practice, with several role-play prompts in each category.
- Beginner, intermediate and advanced conversation levels.
- Tap-to-speak with a text-entry fallback; Chrome on Android generally has the best built-in speech-recognition support. Pronunciation mode can also send a short audio clip to Gemini for approximate feedback and transcription.
- A correction card after every user turn, plus an optional approximate pronunciation estimate and a local tricky-words list.
- Browser speech playback with India, US and UK English locale preferences and adjustable speed.
- End-of-session practice snapshot, recent history and saved words. Summaries are stored in the browser; raw recordings are not stored by SpeakUp.
- PWA manifest and service worker for installing the app from a secure HTTPS site.

## Run it locally

Requirements: Node.js 20 or newer. No package installation is needed.

```sh
cd speakup
npm start
```

Open <http://localhost:3000>. The built-in free practice modes can be explored without a key, but live Gemini replies require a Gemini API key.

## Connect Gemini

1. Sign in to [Google AI Studio](https://aistudio.google.com/apikey) and create an API key. Google decides free-tier availability and quotas based on its current account, region and model rules; check the terms and limits shown in AI Studio.
2. In SpeakUp, open **Settings**, paste the key, and choose **Save settings**. Use **Test connection** if you want to check it.
3. The default model is `gemini-3.1-flash-lite`; `gemini-2.5-flash` is available as an alternative. Model availability can change, so select a model enabled for your API key if needed.

The key is saved in that browser's local storage and sent to this app's `/api/gemini` route, which forwards the request to Google. It is not committed to source files. Do not use this setup on a shared device or expose a server-side API key on a public app. A server configured with `GEMINI_API_KEY` will use that server key for all requests; only do that on a private, single-user deployment.

## Use it on a phone

The app is responsive and can be installed from the browser's **Add to Home screen / Install app** menu when served from HTTPS. Microphone recording requires a secure context (HTTPS, or localhost on the same device) and browser permission. For best built-in speech-to-text support, try Chrome on Android. Some iOS browsers do not expose the same speech-recognition feature; in those cases, typing is available, and pronunciation mode can send recorded audio to Gemini for transcription if the browser supports recording.

For a private hosted copy, deploy this folder to a Node 20 host that supports long-running Node apps and HTTPS. Use `npm start` as the start command and let the host provide its `PORT`. Keep the instance private: this minimal personal-use app does not include user accounts or public abuse protection. Avoid setting `GEMINI_API_KEY` on a public instance.

## Data and privacy

- The app stores the API key, preferences, practice summaries and tricky words in the current browser's local storage.
- Chat text is sent to Google Gemini for replies/corrections. If pronunciation feedback is on and you speak with the microphone, the short audio recording is also sent to Gemini for approximate guidance. SpeakUp does not persist the audio.
- When available, built-in speech recognition is provided by the browser/device; its audio handling follows that provider's own terms.
- Google free-tier data terms may differ from paid terms and may permit submitted content to be used to improve products. Avoid practising with sensitive personal details.
- Use **Settings → Export my practice data** or **Clear saved data** to manage locally stored practice information.

## Notes

- The pronunciation number and word tips are AI-generated guidance, not phoneme-level scoring, a formal exam, or an accent judgment.
- The service worker caches the app shell for offline viewing. Gemini practice still needs internet access.
