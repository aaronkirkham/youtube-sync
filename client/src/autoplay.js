import VideoData from './video';

export const AutoplayCapabilities = {
  Forbidden: 0,
  Allowed: 1,
  OnlyWhenMuted: 2,
};

export function getAutoplayCapabilities(cb) {
  const element = document.createElement('video');
  element.src = URL.createObjectURL(VideoData);
  element.setAttribute('playsinline', 'playsinline');

  element.play()
    .then(() => cb(AutoplayCapabilities.Allowed))
    .catch(() => {
      // now try again with the audio muted
      element.muted = true;
      element.play()
        .then(() => cb(AutoplayCapabilities.OnlyWhenMuted))
        .catch(() => cb(AutoplayCapabilities.Forbidden));
    });
}
