import * as TrainingShare from './trainingUrl.js';

window.TrainingShare = TrainingShare;
window.dispatchEvent(new CustomEvent('training-share:ready'));
